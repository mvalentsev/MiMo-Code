import { expect, test } from "bun:test"
import { AppRuntime } from "../../src/effect/app-runtime"
import { Installation } from "../../src/installation"

test("Installation.method() works without Instance context (mimo upgrade scenario)", async () => {
  const method = await AppRuntime.runPromise(Installation.Service.use((svc) => svc.method()))
  expect(typeof method).toBe("string")
})
