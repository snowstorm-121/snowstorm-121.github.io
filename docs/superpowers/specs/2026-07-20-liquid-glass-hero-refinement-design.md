# Liquid Glass Hero Refinement Design

## Intent

Retain the dark night-coast identity while making the homepage feel quieter, lighter, and more intentionally layered: restrained Apple-like liquid glass rather than a bright, heavy, or skeuomorphic interface.

## Layout

At desktop widths above 1320px, the independent search and quote lane moves left by a clamped offset. It remains structurally independent from the typewriter content and retains a fixed search anchor. The lane becomes narrower, while the quote type scale is reduced so either fixed line stays inside the clear central area and cannot visually enter the right player card.

The player remains in the third grid column, but becomes a compact focal object: reduced maximum width, reduced deck/record dimensions, and a small negative vertical translation. Its hover/parallax transform and reduced-motion behavior remain intact.

At 1320px and below, the existing single-column normal document flow remains unchanged: profile, heading, search, quote, then player. The desktop offsets and player translation are reset.

## Material System

Introduce a small set of CSS custom properties for the shared glass surface: a low-opacity blue-white fill, a hairline highlight border, layered inset lighting, a deep ambient shadow, and a backdrop blur/saturation treatment. Apply the same material language to the fixed header, profile card, search bar, vinyl card, contact popover, and archive cards.

Each surface receives only a restrained top-left sheen and a soft radial highlight. No external assets, gradients with animated motion, or new runtime dependencies are added. Existing hover behavior stays functional; the existing reduced-motion guard continues to disable continuous/parallax animation.

## Acceptance Criteria

- Desktop quote/search lane is shifted left and uses a narrower safe width than the current centered 520px lane.
- Desktop quote type scale is reduced and remains in its two-line fixed-height wrapper.
- Desktop vinyl card is smaller and shifted upward without changing its playback, lyrics, or hover semantics.
- No central copy reaches under the player card; 1320px and below retain normal source and visual order.
- Header, profile card, search, vinyl card, popover, and archive cards share a subtle glass material system.
- Preserve the sole `profileAudio`, all local MP3/LRC/cover assets, original SVG social icons, existing interaction scripts, and no new dependencies or remote images.
- Static suite covers geometry/material invariants; after implementation, inspect desktop, 1024px, 320px, and reduced-motion rendering where browser policy permits.
