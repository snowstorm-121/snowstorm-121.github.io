# Exclusive Sync Contract Report

## Scope

This change documents the supported concurrency boundary for `scripts/sync-pytorch.mjs` without changing generated site content, source notes, publication behavior, journal recovery, or ownership preflight.

The supported operating contract is intentionally narrow:

- Run the synchronizer only in an exclusive worktree with no external writer modifying `learning/pytorch`.
- The existing owner sidecar excludes only another `sync-pytorch` process that participates in the same protocol.
- Editors, deployers, and other processes must not modify manifest-managed output while synchronization runs.
- If that contract is violated, protection is not guaranteed.

No native dependency or general filesystem lock was added.

## RED / GREEN Evidence

RED added a real child-process CLI test named `--help states the exclusive-worktree concurrency boundary`. Before the implementation, `--help` exited `1` as an unknown argument, so the test failed on the expected `0` exit-code assertion.

GREEN adds only a `--help` path and the concurrency text. The focused contract test and the existing `a live publish transaction is exclusive and a dead owner is recoverable` test then both passed. The latter continues to prove that a second participating synchronizer fails closed while the first owner PID is live.

## Verification

All commands used the repository's pinned Node runtime:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pytorch-sync.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/sync-pytorch.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/pytorch-sync.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习' --check
git diff --check
git diff --exit-code -- learning/pytorch
find learning -maxdepth 1 -name '.pytorch-sync-*' -print
```

Results:

- Focused PyTorch sync suite: `67` passed, `0` failed.
- Syntax checks: both exited `0`.
- Full suite: `154` passed, `0` failed.
- Real-source sync check: `32` notes, `7` stages, `29` remote images, `0` warnings; exit `0`.
- Diff whitespace check: exit `0`.
- Generated `learning/pytorch` diff: none.
- Transaction/GC residue check: no output.

## Residual Concern

The owner sidecar is not a general lock that editors or deployment tools automatically honor. Existing inode and no-clobber checks still reject several detected races, but they do not promise protection against every external writer. Operational exclusivity is therefore a required precondition, not an implementation guarantee.
