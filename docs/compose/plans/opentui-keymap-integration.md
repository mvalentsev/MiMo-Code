---
feature: opentui-keymap-integration
status: draft
branch: (not started)
depends-on: experiment/opentui-0.4.3-upgrade
---

# @opentui/keymap Integration Plan

## Context

Upstream opencode (dev) introduced `@opentui/keymap` (0.4.3) as the sole key-to-command engine, replacing the hand-rolled keybinding system. Our codebase (MiMo-Code) still uses the old system. This plan describes migrating to `@opentui/keymap` after the 0.4.3 upgrade lands.

## What @opentui/keymap Replaces (in our codebase)

| Our current file | Role | Replaced by |
|-----------------|------|-------------|
| `src/util/keybind.ts` | Parse/match key strings manually | `@opentui/keymap` core (`stringifyKeyStroke`, `Binding`) |
| `src/cli/cmd/tui/context/keybind.tsx` | `useKeybind()` context, manual leader timeout | `@opentui/keymap/solid` (`KeymapProvider`, `useKeymap`, `useBindings`) + `registerTimedLeader` addon |
| `src/cli/cmd/tui/component/textarea-keybindings.ts` | Manual textarea key→action mapping | `registerManagedTextareaLayer` addon |
| Manual command palette registration | `CommandOption[]` arrays | `keymap.getCommandEntries()` introspection |

## What @opentui/keymap Provides

- **Keymap instance** — state machine for key→command dispatch with layers
- **Command system** — named actions with metadata (`title`, `category`, `namespace`, `hidden`, `enabled`, `run`)
- **Layer system** — mode-scoped binding groups, lifecycle-tied to components via `useBindings()`
- **Leader/sequence keys** — `registerTimedLeader` for multi-key sequences
- **Addon behaviors** — escape clears pending, backspace pops, comma bindings, layout fallback, textarea layer
- **Solid.js integration** — `KeymapProvider`, `useKeymap()`, `useKeymapSelector()`, `useBindings()`
- **Formatting** — `formatKeySequence`, `formatCommandBindings` for UI display
- **Introspection** — `getActiveKeys()`, `getCommandEntries()` for which-key/command palette
- **Plugin runtime** — `runtimeModules` for plugin sandbox imports
- **Testing** — `createTestKeymap` for unit tests

## Upstream Usage Patterns

1. **Bootstrap**: `createDefaultOpenTuiKeymap(renderer)` → register addons → `<KeymapProvider>`
2. **Component binding**: `useBindings(() => ({ mode, bindings, commands, enabled }))`
3. **Plugin commands**: `api.keymap.registerLayer({ commands, bindings })`
4. **Dispatch**: `keymap.dispatchCommand("session.redo")`
5. **Config bridge**: `TuiKeybind` module defines defaults, user overrides, and produces `BindingLookupView`

## Migration Steps (estimated order)

1. Add `@opentui/keymap: "0.4.3"` to workspace catalog and package dependencies
2. Create `src/cli/cmd/tui/keymap.tsx` — bootstrap keymap, register addons, provide context
3. Create `src/cli/cmd/tui/config/keybind.ts` — define command maps, defaults, config bridge
4. Migrate existing keybind definitions from `context/keybind.tsx` into keymap commands/layers
5. Replace `useKeybind()` callsites with `useKeymap()` / `useBindings()` pattern
6. Migrate textarea keybinding setup to `registerManagedTextareaLayer`
7. Update plugin API to expose `api.keymap.registerLayer()`
8. Update command palette / which-key UI to use introspection APIs
9. Remove old files: `util/keybind.ts`, `context/keybind.tsx`, `component/textarea-keybindings.ts`
10. Update tests

## Risks

- **Large surface area**: Almost every TUI component uses keybindings. This is not a small change.
- **Plugin API breakage**: Plugin keybind registration API will change shape.
- **Behavioral differences**: The new system's leader key timeout, layer precedence, and sequence handling may differ subtly from our current implementation.
- **Testing**: Need comprehensive manual testing of all keybind flows.

## Recommendation

This should be done as a separate branch off `experiment/opentui-0.4.3-upgrade` (or after it merges). It's a medium-to-large refactor (~15-20 files touched) that should be validated interactively before merging.
