# Task 5: Restore the QQ penguin icon

## Scope

- Replaced only the QQ inline SVG in the fourth-section social link.
- Kept the existing QQ `href`, anchor semantics, `aria-label`, keyboard behavior, and glass-circle styling.
- Did not modify WeChat markup, dialog behavior, or script.

## TDD evidence

### RED

Command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='QQ stays a direct link with a filled penguin silhouette' tests/homepage-hero.test.mjs
```

Result: exit 1; `pass 0`, `fail 1`.

Expected failure: the QQ anchor did not match `<svg[^>]*data-icon="qq-penguin"[^>]*fill="currentColor"` because it still contained the previous chat-bubble SVG.

### GREEN

Focused command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='QQ stays a direct link with a filled penguin silhouette' tests/homepage-hero.test.mjs
```

Result: exit 0; `pass 1`, `fail 0`.

Complete command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Result: exit 0; `pass 36`, `fail 0`.

Formatting check:

```sh
git diff --check
```

Result: exit 0 with no output.

## Files

- `index.html`
- `tests/homepage-hero.test.mjs`

## Self-review

- QQ remains a direct external anchor with the original destination, label, target, and rel attributes.
- The replacement SVG is filled with `currentColor` and contains only a rounded head/body, outward wings, and feet; it has no text, outlines, logo letters, or facial detail.
- The test locks the QQ-only marker and all silhouette parts, and rejects dialog/contact attributes on the QQ link.
- WeChat markup and runtime were not changed; its existing dialog tests remain green.

## Concerns

None. This task deliberately does not change layout, CSS, or interaction code.
