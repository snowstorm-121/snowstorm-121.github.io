# Last Review Fix Report

## Status

Implemented the six Important findings and one Minor finding from the final review on
`feature/midnight-archive-atlas`, starting at `bd3bd71`.

- Publication now treats ownership as an exact manifest-path property, rejects case-folded unmanaged aliases before staging, and revalidates the accepted inode immediately before replacement or deletion.
- Next-only outputs use no-clobber hard links. Prepared rollback removes them only while the public file still matches this transaction's retained published-file proof.
- A fixed transaction is acquired through an atomic external owner sidecar, bound to the resolved output root, UUID, and live PID. Live transactions are exclusive; missing or invalid ownership fails closed, including an empty foreign fixed directory.
- Prepared and committed cleanup retain the external ownership proof until an owned GC tree has been removed. Real `SIGKILL` tests cover acquisition, publication, prepared GC handoff, and committed GC deletion.
- Active legacy slugs reserve their NFC/case-folded routes before new notes are allocated. New suffixes use deterministic source ordering and are fixed before credential validation, remote fetches, or staging writes.
- Atlas Enter and Space now navigate to the selected `data-atlas-href` while empty nodes remain selectable and non-navigating.
- Reading TOCs start closed, are viewport-bounded with internal desktop scrolling, and remain compact before the article on mobile.
- A Markdown-provided leading H1 remains verbatim and suppresses only the duplicate wrapper H1. The generated Markdown is byte-for-byte identical to the source.

Only the 32 manifest-managed generated note HTML files were regenerated. No source Markdown or unmanaged public file was modified or removed.

## RED / GREEN Evidence

### Publication and transaction ownership

RED regressions reproduced before their production fixes:

- A same-content next-only case alias was accepted and could be overwritten or removed during prepared recovery.
- A case-fold alias that resolved to a managed inode was treated as owned even though its exact path was absent from the manifest.
- Replacing a managed target with a same-content new inode after preflight was silently overwritten.
- A child-process race that swapped the inode after published-anchor creation but before the final replacement was silently overwritten.
- An empty unowned fixed transaction directory was deleted.
- A second live sync recovered and deleted the first sync's no-journal transaction instead of reporting it active.
- `SIGKILL` after fixed-directory acquisition but before the inner marker left an unreconciled acquisition artifact.

GREEN behavior:

- Public case-fold aliases must be exact previous-manifest entries; inode equality is used only as transaction proof.
- Previous files and newly published files retain same-filesystem hard-link anchors. Final destination-to-anchor identity validation directly precedes replacement/deletion.
- Created destinations use no-clobber `link`; prepared rollback deletes only a destination matching the transaction's published anchor and preserves same-content manual inodes.
- The fully written external owner is installed with an atomic no-clobber hard link before the fixed directory is created. A live owner causes a busy failure; a dead owner is recovered; unknown fixed directories are preserved.
- Internal owner removal is last inside the GC tree and the external owner is removed after the GC tree, so interrupted cleanup is retryable.

Focused result: `66` PyTorch sync tests passed, including all real child-process `SIGKILL` and concurrent-live-owner cases.

### Slugs and page behavior

RED regressions reproduced before their production fixes:

- A new lower-case alias could take an active uppercase legacy route, with the collision discovered only after later publication work.
- Enter/Space selected atlas nodes but did not navigate.
- Generated articles duplicated a matching Markdown H1.
- Long TOCs opened by default and extended beyond the desktop viewport.

GREEN behavior:

- `Case-Slug` and an already reserved `case-slug-2` force a new note deterministically to `case-slug-3`; the credential/missing-asset regression records zero fetches and zero staging writes.
- Enter/Space navigate real stage controls; empty controls do not navigate.
- Matching source H1 output contains one H1 and preserves the exact Markdown bytes.
- The 89-item Stage 5 TOC starts closed, opens inside a bounded scrolling region, and is closed on a 320px viewport.

## Transaction Invariants

1. Before the `prepared` journal, public output is untouched.
2. The owner sidecar is external to recursive cleanup, schema-validated, output-root-bound, and exclusive. The in-tree marker is installed as its hard link.
3. Previous manifest-managed files are hard-linked into `previous/` only after their preflight identity is verified.
4. Every staged output gets a retained `published/` proof before its final ownership check. Next-only targets are linked with no-clobber; replacements are renamed only after the destination still matches its previous anchor. `manifest.json` is last.
5. Prepared recovery restores only missing destinations or files matching this transaction's published proof, and removes created paths only when that proof still matches.
6. Committed cleanup removes an obsolete prior path only while it still matches the retained previous anchor.
7. Cleanup atomically hands the fixed tree to its UUID GC name, removes the in-tree owner last, removes the external owner after the tree, and converges after interruption.

The static re-review returned **Ready / no blockers**. It noted one deliberately conservative residual: a `SIGKILL` between creation of the unique pending-owner temp file and installation of the external sidecar may leave that unique temp file. It does not block later syncs or touch public data; without the installed owner proof it is intentionally not auto-deleted under the unmanaged-file boundary.

## Final Verification

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/sync-pytorch.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/pytorch-sync.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/archive-atlas.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/pytorch-reading.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习' --check
git diff --check
find learning -maxdepth 1 -name '.pytorch-sync-*' -print
```

Results:

- Syntax checks: exit `0`.
- Full test suite: `153` passed, `0` failed.
- Real-source sync check: `32` notes, `7` stages, `29` remote images, `0` warnings; exit `0`.
- Diff check: exit `0`.
- Transaction/GC residue check: no output.

## Localhost Browser Verification

An isolated copy containing only `assets/` and `learning/` was served on localhost, tested through the in-app browser, then stopped and deleted.

- Enter on “Tensor 与自动微分” navigated to `/learning/pytorch/stage-1/`.
- Space on “模型与训练闭环” navigated to `/learning/pytorch/stage-2/`.
- At `1024 × 768`, the Stage 5 article had one H1 and 89 TOC items. The TOC started closed; opened height was `708.5px` under a computed `716px` maximum, and its list had `664px` client height, `2719px` scroll height, and `overflow-y: auto`.
- At `320 × 568`, the TOC started closed at `44.5px`, the article began below it, the article still had one H1, and there was no horizontal overflow.
- Browser warnings: none.
