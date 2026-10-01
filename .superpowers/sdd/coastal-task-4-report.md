# Coastal Task 4 implementation report

Pre-task HEAD: `d56a15f5edea4eaf2ca4bfeb5c9c3861db90d3c6`.
Branch: `feature/midnight-archive-atlas`.

## Scope

Generator changes are limited to `pageTemplate` and the article return label. All 40 generated HTML pages now load shared theme state before styles, include a same-surface header/native tide toggle, and show the existing coast photo in a narrow locally shaded banner. Reading progress, TOC, canonical URLs, stage counts/order and previous/next navigation remain intact. Text, TOC, code, tables, task lists and attachments use solid reading surfaces. Mobile wrapping and system link pointers remain available. The unrelated dirty `.superpowers/sdd/task-4-report.md` was preserved and excluded from staging.

## RED and GREEN

Initial focused command: bundled Node `--test tests/pytorch-reading.test.mjs tests/pytorch-sync.test.mjs`.
Observed four expected failures: missing shared shell/header/banner; missing theme-variable surfaces; obsolete return label; translucent table/task/attachment surfaces. Existing sync tests continued passing. Tests were written before production edits.

A second RED contrast test failed with `light-mode text accent needs an AA override`. Following coordinator approval, PyTorch ordinary accent text uses scoped `#855e3b` in light mode (including no-script fallback); shared design tokens remain unchanged. Links and attachment links consume this local text token. Dark mode uses the shared accent.

Focused GREEN: 97/97 tests. Full GREEN: 287/287 tests, zero failures/skips. No tests removed.

Contrast ratios on solid surfaces: light accent 5.05:1; dark accent 9.49:1; light body 11.39:1; dark body 16.18:1. The original shared day accent was 3.87:1, motivating the scoped correction.

## Content and ownership evidence

Extracted each exact string between `<div class="note-content">` and `</div></article>` from pre-task `git show` and the regenerated file, then asserted strict equality for every manifest note: **32/32 byte-identical bodies**. This includes heading IDs, code, article links, image markup and attachment content.

Checked changed archive paths against `manifest.generatedFiles`: **40/40 are manifest-owned HTML**. No generated Markdown, image bytes, manifests, atlas JSON or source notes changed. A first ownership diagnostic mistakenly checked nonexistent `managedFiles`; rerunning against the actual `generatedFiles` schema passed.

Sync generation and `--check --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习'` both reported `32 notes, 7 stages, 29 remote images, 0 warnings`.
`node --check scripts/sync-pytorch.mjs`, `node --check assets/reading-theme.js`, and `git diff --check` passed.

## Self-review and remaining validation

Reviewed wrapper/CSS diff: content renderer untouched; shared theme resources precede page styles; stable opaque article background; theme-independent banner fallback; visible focus outlines restored after component rules; links use native pointers; long mobile labels can wrap. Existing sync tests already cover real renderer output and routing, so no redundant sync fixture was added.

Browser viewport/screenshot, touch, background failure and final whole-branch visual review are coordinator-owned outstanding checks. No browser validation was claimed here. Independent reviewer approval is still required before integration.
