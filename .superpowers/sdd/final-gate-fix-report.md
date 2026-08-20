# Final Gate Fix Report

## Status

Implemented the four final review fixes on `feature/midnight-archive-atlas` from starting HEAD `3f2e2a0`.

- Case-folded attachment destinations now collide before staging, including `Plot.png` versus `plot.png` from different sources.
- Legacy manifest slugs are validated for strict format and case-fold uniqueness before remote or staging I/O.
- PyTorch publication keeps the public root in place, atomically replaces individual files, publishes the manifest last, and recovers interrupted prepared/committed transactions from a validated journal.
- Cursor trail strength now uses distance divided by pointer sample time while retaining the existing heading response and fast-to-slow decay.

## TDD Evidence

### RED

Each regression was observed against the original production implementation before its fix:

- Attachment case collision reached staging and failed only as generated drift instead of reporting the two colliding sources.
- `bad_slug` was accepted and the case-folded slug pair reached later publication work rather than failing manifest validation.
- A child process killed by real `SIGKILL` during the two-directory rename left an old managed URL missing with `ENOENT`.
- A 40px move over 1 second produced full trail strength `1`, identical to a 40px move over 16ms.
- The first stable-root implementation exposed a missing-journal error that masked an injected staging failure; a focused test reproduced it before the recovery boundary was corrected.
- An incomplete journal without its next-manifest proof was silently discarded; a focused test reproduced that validation gap before strict journal checks were added.

### GREEN

Focused command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='case-folded attachment|legacy manifest slugs|manifest loading enforces|staged write failure|incomplete publish journal|SIGKILL during publication|manifest cleanup' tests/pytorch-sync.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='trail strength normalizes|moon-scale shoal uses one RAF|first pointer position' tests/homepage-hero.test.mjs
```

Result: all focused tests passed, including the real `SIGKILL` child-process recovery.

## Implementation Boundaries

### Publication

- The stable public output root is never renamed away.
- A fixed same-filesystem transaction directory holds fully staged outputs, copies of only the previous manifest-managed files, a saved next manifest, and an atomically written `prepared`/`committed` journal.
- Journal paths are case-fold unique, constrained by `safeManagedPath`, and must exactly match the validated previous and next manifests.
- Prepared recovery copies the retained previous snapshot to recovery files and atomically renames those copies over public managed files, so recovery itself is repeatable after interruption.
- Individual next files are atomically renamed into the stable root; `manifest.json` is explicitly last.
- Obsolete cleanup is deferred until the committed journal exists and is limited to previous manifest-managed files. Case-fold aliases cannot delete their replacement on case-insensitive filesystems.
- Unmanaged files remain outside the journal, backup, replacement, rollback, and cleanup sets.

### Validation and cursor

- Slugs accept NFC letters/numbers joined by single hyphens and reject separators such as `/`, `..`, `_`, whitespace, and malformed hyphen runs.
- Note routes are unique by case-folded `stageKey/slug`; generated manifest paths and attachment destinations use the same case-fold collision boundary.
- Cursor trail thresholds are expressed in pixels per millisecond (`.25` to `2.5`), making 40px/1s low and 40px/16ms high while preserving the 180ms peak decay.

## Final Verification

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/sync-pytorch.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/cursor-shoal.js
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/pytorch-sync.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/homepage-hero.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习' --check
git diff --check
```

Results:

- Syntax checks: exit `0`.
- Full tests: `140` passed, `0` failed.
- PyTorch sync check: `32` notes, `7` stages, `29` remote images, `0` warnings; exit `0`.
- Diff check: exit `0`.
- No transaction directory remained after tests or the real-source check.

## Localhost Browser Verification

Validated through the in-app browser against a temporary localhost static server:

- Homepage loaded without horizontal overflow or browser console warnings/errors.
- One cursor-shoal layer initialized; pointer movement made it visible and moved its core to the sampled pointer position.
- PyTorch archive rendered all `7` tide stages without horizontal overflow.
- The generated Stage 6 RAG article loaded with one article, `37` TOC links, no horizontal overflow, and no browser console warnings/errors.

## Concern

Publication is atomic per file, not an atomic whole-tree exchange. A live reader can briefly observe an old/new mixture during a successful sync, but the public root and existing file paths are never renamed away; the manifest is published last, and interruption recovers to the complete previous managed snapshot before the next check or sync.
