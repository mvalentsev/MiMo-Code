import { describe, expect } from "bun:test"
import { Deferred, Effect, Layer } from "effect"
import { Bus } from "../../src/bus"
import { Config } from "../../src/config"
import { Agent } from "../../src/agent/agent"
import { Memory } from "../../src/memory"
import { ActorRegistry } from "../../src/actor/registry"
import { Actor, type AgentOutcome } from "../../src/actor/spawn"
import { spawnRef } from "../../src/actor/spawn-ref"
import { TaskRegistry } from "../../src/task/registry"
import { SessionCheckpoint } from "../../src/session/checkpoint"
import { checkpointPath } from "../../src/session/checkpoint-paths"
import { Log } from "../../src/util"
import { Plugin } from "../../src/plugin"
import { provideTmpdirInstance } from "../fixture/fixture"
import { Session as SessionNs } from "../../src/session"
import { MessageID, PartID } from "../../src/session/schema"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { ProviderTest } from "../fake/provider"
import { testEffect } from "../lib/effect"
import * as fs from "fs/promises"
import * as CrossSpawnSpawner from "../../src/effect/cross-spawn-spawner"

void Log.init({ print: false })

const ref = {
  providerID: ProviderID.make("test"),
  modelID: ModelID.make("test-model"),
}

// Actor stub whose outcome NEVER resolves — a checkpoint writer that stays
// in-flight for the whole test. This lets us assert what renderRebuildContext
// does WHILE a writer is running, without a real (slow) LLM round-trip.
const hangingActor = Layer.effect(
  Actor.Service,
  Effect.gen(function* () {
    const prevSpawnRef = spawnRef.current
    let counter = 0
    const impl = Actor.Service.of({
      spawn: (input) =>
        Effect.gen(function* () {
          counter += 1
          const outcome = yield* Deferred.make<AgentOutcome>()
          return {
            actorID: `${input.agentType}-${counter}`,
            sessionID: input.sessionID,
            outcome,
          }
        }),
      cancel: () => Effect.void,
      getForkContext: () => Effect.succeed(undefined),
    })
    spawnRef.current = impl
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (spawnRef.current === impl) spawnRef.current = prevSpawnRef
      }),
    )
    return impl
  }),
)

const deps = Layer.mergeAll(
  ProviderTest.fake().layer,
  Agent.defaultLayer,
  Plugin.defaultLayer,
  Bus.layer,
  Config.defaultLayer,
  Memory.defaultLayer,
  TaskRegistry.defaultLayer,
  ActorRegistry.defaultLayer,
  hangingActor,
)

const env = Layer.mergeAll(
  SessionNs.defaultLayer,
  CrossSpawnSpawner.defaultLayer,
  SessionCheckpoint.layer.pipe(Layer.provide(SessionNs.defaultLayer), Layer.provideMerge(deps)),
)

const it = testEffect(env)

// Register an in-flight (hanging) writer for a fresh session. Inlined into each
// test's Effect.gen so svc/ssn carry their resolved service types (matching the
// pattern in checkpoint-drain.test.ts). Returns the created session info.
function seedSessionWithWriter() {
  return Effect.gen(function* () {
    const svc = yield* SessionCheckpoint.Service
    const ssn = yield* SessionNs.Service
    const info = yield* ssn.create({})
    const user = yield* ssn.updateMessage({
      id: MessageID.ascending(),
      role: "user",
      sessionID: info.id,
      agent: "build",
      model: ref,
      time: { created: Date.now() },
    })
    yield* ssn.updatePart({
      id: PartID.ascending(),
      messageID: user.id,
      sessionID: info.id,
      type: "text",
      text: "seed",
    })
    const started = yield* svc.tryStartCheckpointWriter({
      sessionID: info.id,
      model: { providerID: "test", modelID: "test-model" },
      promptOps: {} as never,
    })
    expect(started).toBe("started")
    return info
  })
}

describe("renderRebuildContext: non-blocking on real content, blocks only on template-only", () => {
  it.live(
    "on-disk checkpoint present + writer in-flight → returns promptly using the file",
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const svc = yield* SessionCheckpoint.Service
        const info = yield* seedSessionWithWriter()

        // Writer is hanging (in-flight). Now put a checkpoint.md on disk.
        const marker = "MARKER_ONDISK_CHECKPOINT_BODY"
        yield* Effect.promise(() =>
          fs.writeFile(checkpointPath(info.id), `# Session checkpoint\n\n## §1 Active intent\n${marker}\n`),
        )

        // Pre-fix this call would block up to 60s on the Effect.race waiting for
        // the (never-resolving) writer. Assert it returns fast AND surfaces the
        // on-disk body — i.e. it used the file instead of waiting.
        const started = Date.now()
        const ctx = yield* svc.renderRebuildContext(info.id, { agentID: "main" })
        const elapsedMs = Date.now() - started

        expect(elapsedMs).toBeLessThan(5_000) // nowhere near the 60s block
        expect(ctx).toContain(marker)
      }),
    ),
  )

  it.live(
    "on-disk file is only the bare template + writer in-flight → blocks (won't rebuild from placeholders)",
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const svc = yield* SessionCheckpoint.Service
        const info = yield* seedSessionWithWriter()

        // tryStartCheckpointWriter bootstraps checkpoint.md from the bare
        // template (all "(none yet)") before the writer produces real content.
        // The file therefore EXISTS but carries no distilled context yet.
        // Rebuilding from it would push placeholder noise and drop the session's
        // real context — so the fix must NOT take the fast path here; it must
        // wait (bounded) for the writer to write real content.
        const onDisk = yield* svc.hasCheckpoint(info.id)
        expect(onDisk).toBe(true) // file exists...

        // ...but because it's template-only, renderRebuildContext blocks on the
        // (hanging) writer. Bound the observation to 2s and assert it is STILL
        // waiting (None) rather than having returned a placeholder rebuild. This
        // is the regression guard for the "template ≠ usable content" bug.
        const result = yield* svc
          .renderRebuildContext(info.id, { agentID: "main" })
          .pipe(Effect.timeout("2 seconds"), Effect.option)
        expect(result._tag).toBe("None")
      }),
    ),
  )
})
