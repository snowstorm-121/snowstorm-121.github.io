# Research final review fix

## Scope and evidence

Resolved the Important finding about RetailFlow source drift. Read-only source checkout `/Users/yyy/code/RetailFlow` was at `8dd99df`; read tracked `README.md`, `reports/repair-native-dialogue.md`, `reports/t7-test.md`, and `reports/contribution.md`. No source checkout files were changed.

The site now dates the unchanged B0/B1/B2 Dev 0/9 and Test 0/4 table as historical T6/T7 (2026-10-20), and scopes 104 engineering tests and mixed-text protocol rejection to that version. It separately reports current V5 Dev 1/9, previous V4 Dev 2/9, and 129 engineering tests (2026-10-21), with the public repair report link. Seen-Dev repairs changed protocol adaptation, prompts, and user scripts; there is no new Test run or B0/B1/B2 causal comparison. Current single native tool calls may include explanatory text, which grants no confirmation; multiple tools remain rejected. Added one source-drift clarification to the design spec; no implementation-plan change was needed.

## RED

Added `RetailFlow: historical comparison is separated from current seen-Dev repairs` before editing production HTML. The existing exact historical table regression remains unchanged.

Command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-cases.test.mjs
```

Output: `tests 17; pass 16; fail 1`, exit 1. The new test failed on the missing dated historical table caption, as expected. An earlier bare `node` attempt returned `command not found` (exit 127); it was an environment lookup failure, not RED evidence.

## GREEN and full regression

After the minimal HTML correction, the same focused command produced `tests 17; pass 17; fail 0`, exit 0.

Full command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs counter-worker/tests/*.test.mjs
```

Output: `tests 323; suites 0; pass 323; fail 0; cancelled 0; skipped 0; todo 0`, exit 0. This exceeds the required 303-test baseline.

`git diff --check` produced no output and exited 0. Reviewed the focused HTML/test diff and confirmed all three historical rows and denominators remain intact. No runtime code, dependencies, external services, model runs, merge, or push were involved. This was a text-only evidence correction; no new browser visual pass was performed.

## Handoff

Only the HTML, regression test, design-spec clarification, and this report belong to this fix. The pre-existing dirty `.superpowers/sdd/task-4-report.md` was preserved and excluded from staging. The source report remains a dated snapshot; future project changes require another evidence refresh, not reinterpretation of historical results.
