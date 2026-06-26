---
feature: opentui-0.3.4-upgrade
status: delivered
specs: []
plans: []
branch: fix/tui-paste-highlight-cjk-opentui-0.3.4
commits: 98df392..41137a6
---

# Upgrade @opentui/core to 0.3.4 — Final Report

## What Was Built

`@opentui/core` / `@opentui/solid` were upgraded from 0.1.101 to 0.3.4 (the line
upstream opencode 1.17.x ships), which fixes two TUI issues at once and aligns
our TUI with upstream:

1. **Paste-highlight drift with CJK.** The paste placeholder (the yellow
   `[Pasted ~N lines]` / `[Image N]` / `[PDF N]` / `[SVG: …]` span) now stays
   anchored to its content when wide characters surround it. Previously, typing
   CJK before a placeholder slid the highlight left one column per wide char and
   corrupted the submit position. The application layer was also tightened so
   display-width offsets and UTF-16 string indices never get mixed.
2. **Streaming markdown flicker.** Assistant text rendered through opentui's
   `<markdown>` no longer flashes raw markers (`-`, `##`, `**`) on already-settled
   lines as new content streams in.

## Architecture

Two coordinate systems meet in the prompt: the editor (`@opentui/core`) tracks
cursor and extmark offsets in **display width** (a wide CJK char = 2 columns, a
newline = 1, a tab = 2, and — verified against the editor — an emoji ZWJ
sequence like `👨‍👩‍👧` = 6, a skin-tone emoji `👍🏽` = 4), while the
`plainText` we slice in JS is **UTF-16** (those same chars are 1–8 units). The
fix keeps these two coordinate systems strictly separated.

- **`@opentui/core` 0.3.4** — fixes the root cause inside the editor:
  `adjustExtmarksAfterInsertion` now shifts extmarks by the inserted text's
  display width (visual-cursor delta) instead of `text.length`, so a wide char
  before a placeholder moves its extmark 2 columns, not 1. (Upstream opentui PR
  #1102, first released in 0.2.16.)
- **`component/prompt/offset.ts`** — the shared width↔index converters
  (`widthToStringIndex`, `stringIndexToWidth`, `charAfterCursor`, and the new
  `promptOffsetWidth`). Iteration is **per code point** with `\n`→1 / `\t`→2
  special cases, which matches the editor byte-for-byte.
- **`component/prompt/index.tsx`** — application-layer call sites that derive an
  extmark span or a cursor position from text now go through the converters:
  `pasteText` / `pasteAttachment` extmark ends, the `/editor` restore path
  (`content.indexOf` UTF-16 result → display-width offset), and the post-editor
  cursor.
- **`component/prompt/part.ts`** — `expandPlaceholders` (from #1292) still bridges
  the two systems at submit time; it is retained, not reverted.
- **`routes/session/index.tsx`** — the assistant-text `<markdown>` now sets
  `internalBlockMode="top-level"` + `tableOptions={{ style: "grid" }}`, so each
  top-level markdown block renders as its own child and only the unstable trailing
  block rebuilds during streaming.

Data flow on submit: extmark `start`/`end` (display width) → `widthToStringIndex`
→ UTF-16 indices → `String.slice` replaces each placeholder with its real pasted
content, applied right-to-left so earlier offsets stay valid.

### Design Decisions

- **Upgrade opentui rather than patch our vendored copy.** The root cause was an
  opentui bug already fixed upstream (PR #1102) and shipping in the version
  upstream opencode 1.17.x uses (0.3.4). Upgrading aligns us with upstream and
  avoids maintaining a fork patch. All 25 opentui symbols we import still exist
  in 0.3.4 and `packages/opencode` typechecks clean, so the major-version jump
  is non-breaking for our usage.
- **Per-code-point iteration, not graphemes.** Upstream's `display.ts` uses
  `Intl.Segmenter` (grapheme clusters), which measures an emoji ZWJ sequence as
  width 2 — but the editor advances by the wcwidth of each code point, making it
  6. Our per-code-point pass matches the editor exactly; a grapheme "upgrade"
  would reintroduce drift on emoji, so it is documented against in `offset.ts`.
- **Keep the `\t`→2 special case.** Tab can't be typed in the prompt (Tab
  switches agent), but it enters via paste and the external editor, and the
  editor counts it as width 2. Upstream's converter omits this case; we keep it.
- **#1292 is complementary, not redundant.** opentui's upgrade fixes extmark
  tracking inside the editor; `expandPlaceholders` fixes the width→UTF-16
  conversion when slicing `plainText` at submit. Both are required.
- **`internalBlockMode="top-level"` for streaming markdown.** opentui's
  `<markdown>` defaults to `"coalesced"` (the whole message is one block, so each
  streamed chunk re-renders everything and flashes raw markers). Notably, the
  0.3.4 upgrade itself made this flicker *more* pronounced than on 0.1.101 (even a
  bare `-` list marker briefly showed raw before settling) — why 0.3.x's coalesced
  re-render is more aggressive than the old version was not fully root-caused.
  Setting `"top-level"` (what upstream has shipped ever since it flipped back to
  the `<markdown>` renderable; it never ran coalesced+streaming in production)
  reduces it markedly. So this is an effective mitigation, not a complete
  explanation of why the upgrade regressed it first.

## Usage

No user-facing API change. Behavior change only: pasting after — or typing wide
characters before — a paste/image/PDF/SVG placeholder now keeps the highlight
aligned and submits the correct expanded content. Streaming assistant markdown
no longer flickers raw markers on settled lines as new content arrives.

## Verification

- `packages/opencode` `bun typecheck` — clean (every opentui symbol we use is
  present in 0.3.4).
- `bun test test/cli/cmd/tui/` — 28 pass (3 files).
- Empirical probes against a real `EditBuffer`/`EditorView` confirmed: extmark
  shifts by display width (+2 per CJK) after the upgrade; editor-restore needs
  display-width coords (char index mis-tracks under a CJK prefix); paste +
  newline + submit expands to the exact expected string with no `[Pasted`
  residue; `offset.ts` width matches the editor for CJK, tab, newline, ZWJ and
  skin-tone emoji.
- New regression test in `offset.test.ts` locks the ZWJ (width 6) and skin-tone
  (width 4) measurements to guard against a grapheme regression.

## Journey Log

> Brief notes on what informed the final design. Not required reading.

- [pivot] First read the code and assumed two opentui bugs (extmark adjust +
  `offsetExcludingNewlines`); user's live test on upstream 1.17.7 proved the
  highlight renders correctly, so only the extmark-adjust bug actually affects
  rendering — stop guessing, verify against the running editor.
- [lesson] The screenshot version `OpenCode 1.17.7` is the *upstream* version;
  our fork numbers start at `0.x`. Mixing these up inverted the fix attribution
  once — confirm which build a screenshot is from before reasoning about it.
- [lesson] The editor's offset is neither grapheme- nor `Bun.stringWidth`-based
  for compound emoji: it sums wcwidth per code point (ZWJ family = 6). Measure
  against the real `EditBuffer` rather than trusting a width library.
- [dead end] Tried to reverse-engineer `addHighlightByCharRange`'s native
  coordinate semantics via rendered cells; the test-renderer cell API wasn't
  worth the depth once the user's live test already showed upstream renders
  correctly.
- [lesson] The 0.3.4 upgrade *increased* streaming markdown flicker versus
  0.1.101 (raw `-`/`##` flashing on settled lines), root cause not fully
  explained; `internalBlockMode="top-level"` mitigated it. Treat this as a signal
  that 0.3.x's render/redraw behavior differs non-trivially from 0.1.x — other
  undiscovered regressions are plausible and warrant real-world dogfooding before
  merge.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| (none) | — | Direct debugging fix; no spec/plan documents were produced |
