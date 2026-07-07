---
feature: opentui-0.4.3-upgrade
status: delivered
specs: []
plans: []
branch: experiment/opentui-0.4.3-upgrade
commits: (uncommitted)
---

# @opentui 0.4.3 Upgrade — Final Report

## What Was Built

Upgraded `@opentui/core` and `@opentui/solid` from 0.1.101 to 0.4.3, aligning with the upstream opencode dev branch. This removes the `bun patch` workaround (PR #1471) that fixed CJK paste-highlight drift at the JS level, because the fix is now natively included in opentui since version 0.2.16. Additionally, the streaming markdown flicker mitigation (`internalBlockMode="top-level"` + `tableOptions`) from the previously-closed PR #1385 is applied, matching upstream's production configuration.

This is an **experimental branch** for validation before merging to main.

## Architecture

No structural changes. The upgrade is a dependency bump with minimal type-level adaptations:

- **Root `package.json`**: Catalog versions bumped, `patchedDependencies` entry for `@opentui/core@0.1.101` removed, patch file deleted.
- **`packages/opencode/package.json`** and **`packages/plugin/package.json`**: Direct version references updated to 0.4.3.
- **`packages/plugin/src/tui.ts`**: `TuiDialogPromptProps.description` type changed from `() => JSX.Element` to `JSX.Element` (opentui 0.4.3 is stricter about child node types — functions are no longer implicitly accepted).
- **`packages/opencode/src/cli/cmd/tui/ui/dialog-prompt.tsx`**: Same type change in `DialogPromptProps`.
- **Callers** (`dialog-provider.tsx`, `dialog-session-list.tsx`, `plugins.tsx`): Updated to pass raw JSX elements instead of arrow-function-wrapped JSX.
- **`routes/session/index.tsx`**: `<markdown>` component gains `internalBlockMode="top-level"` and `tableOptions={{ style: "grid" }}` to prevent streaming flicker.

### Design Decisions

- **Target 0.4.3 (not 0.3.4)**: The original closed PR #1385 targeted 0.3.4. Since upstream opencode (dev) now uses 0.4.3, we align directly to avoid another intermediate upgrade later.
- **Keep `offset.ts` as-is**: The existing `offset.ts` (from PR #1292) provides width↔string-index conversion used by the prompt component. It is complementary to — not replaced by — the opentui upgrade and remains unchanged.
- **Remove #1471 patch entirely**: The CJK extmark drift fix is native in 0.4.3 (confirmed by all 7 regression tests passing without the patch).
- **`opentui-spinner` stays at 0.0.6**: It bundles its own nested opentui 0.1.101 internally; no conflict with the hoisted 0.4.3.

## Usage

No user-facing configuration changes. The upgrade is transparent. Developers testing this branch should watch for:

- Streaming markdown rendering behavior (flicker, re-render of stable blocks)
- CJK input + paste highlight positioning
- Dialog components (all use the updated `description` prop type)
- Scrolling, mouse interactions, IME composing

## Verification

| Check | Result |
|-------|--------|
| `bun typecheck` (packages/opencode) | Clean |
| `bun typecheck` (packages/plugin) | Clean |
| `bun test test/cli/cmd/tui/` | 34 pass |
| `bun test test/cli/cmd/tui/extmark-cjk.test.ts` | 7 pass |
| `bun install` (clean, no patch) | Success |

## Known Risks / Follow-up Items

1. **Streaming markdown flicker**: PR #1385 documented that 0.3.x worsened streaming flicker compared to 0.1.x when using the default `coalesced` mode. The `internalBlockMode="top-level"` prop mitigates this, but the underlying cause was never root-caused. **Manual real-use testing is recommended** before merging to main.
2. **`@opentui/keymap`**: Upstream uses this new package (0.4.3). Our codebase does not yet — this is a separate follow-up investigation.
3. **Broader rendering regressions**: opentui is the entire TUI substrate. While types check clean, there may be runtime behavior changes in scrolling, dialogs, selectors, or syntax highlighting that only surface during interactive use.

## Journey Log

> Brief notes on what informed the final design. Not required reading.

- [pivot] Original PR #1385 was closed in favor of #1471 (patch workaround) due to unexplained flicker worsening on 0.3.4. Revisiting now because upstream stabilized on 0.4.3.
- [lesson] The CJK extmark drift was fixed upstream in opentui 0.2.16 (PR #1102). Any version >= 0.2.16 includes the native fix, making the JS patch unnecessary.
- [lesson] opentui 0.4.x tightened JSX child types — `() => Element` no longer assignable where `Element` is expected. This is a minor breaking change that affected 5 callsites.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| PR #1385 | Original upgrade attempt (closed) | Documents flicker risk and CJK fix rationale |
| PR #1471 | Workaround patch (merged, now reverted) | Targeted JS patch on 0.1.101 |
| PR #1471 review comment | Emoji width measurement table | Corrects ZWJ width assumption from #1385 |
