# Homepage Hero Enhancement Design

## Goal

Enhance the existing homepage hero without redesigning the left profile area. The page should take visual cues from the supplied reference: an expressive title and wide search field above the typed quote, a small artful interaction on the right, and compact circular social links at the lower left.

## Preserved elements

- Keep the existing avatar, education card, music controls, track switching, and profile interaction unchanged.
- Keep the existing hero background, navigation, archive section, quote rotation, and mobile profile-first order.
- Change the ambient master playback target from `0.80` to `1.00` so newly started audio uses the maximum gain configured by the page.

## Hero layout

### Wide screens (over 1320px)

- The profile stays fixed in its existing left column.
- The hero main content shifts right of that column and gains a title/search block above the rotating quote.
- The title reads `STILL, I GO ON`, using a slanted, editorial display treatment with a small `PERSONAL ARCHIVE / 121` kicker.
- A translucent rounded search form sits directly below it. Submitting the form opens a Bing query restricted to `snowstorm-121.github.io`; this matches the supplied reference's search convention.
- The typed quote uses a smaller maximum size and a narrower right-shifted content region so it cannot sit below the profile card.
- The social links sit at the lower left, below the profile region.

### Medium screens (721px to 1320px)

- Retain the existing stacked profile-first hero flow.
- Put the title/search block between the profile area and the rotating quote.
- Keep the art widget beside or after the main content where space permits; it must never overlap text.

### Small screens (720px and below)

- Retain the current profile-first stack.
- Render title, search, quote, widget, and social links as full-width or naturally centered blocks with no absolute overlap.
- Reduce title, search, quote, and widget sizes while retaining readable tap targets.

## Right-side art widget: Memory Aperture

The selected widget is a compact `Memory Aperture`, styled as a frosted-glass, deep-sea camera aperture rather than a dashboard.

- Layered metal tick marks, dark iris blades, a soft teal halo, muted gold accents, and low-density dust create depth without bright neon treatment.
- Pointer movement produces a small parallax shift, glow displacement, iris rotation, and blade opening change.
- Clicking cycles the central phrase through `GO ON`, `BREATHE`, `DRIFT`, and `BEGIN`, with a brief pulse response.
- It has a visible focus state, keyboard activation through a native button, and disables nonessential motion under `prefers-reduced-motion`.

## Social links

Use circular brand-icon buttons, with hover/focus lift and a readable accessible label.

| Service | Behavior |
| --- | --- |
| GitHub | Open `https://github.com/snowstorm-121` |
| Email | `mailto:2971234387@qq.com` |
| WeChat | Open an on-page contact popover showing `yan_yongyi` and a copy button; WeChat does not offer a dependable public web profile URL. |
| QQ | Use the QQ direct-contact URL for `2971234387`, with the number visible as a fallback in the same contact popover. |
| YouTube | Open `https://www.youtube.com/@yongyiyan` |
| X | Open `https://x.com/yongyi_121` |

## Acceptance checks

- At desktop width, profile card and quote have separate horizontal regions with no visual overlap.
- The title/search block appears immediately above the quote and does not alter profile placement.
- Audio starts at the configured maximum (`1.00`) after the user activates playback.
- Search, every external social link, and both contact popovers respond correctly.
- The aperture responds to pointer movement and click, works from keyboard focus, and honors reduced motion.
- Layout is checked at 1440px, 1024px, and 390px widths for overflow, clipping, and overlap.
