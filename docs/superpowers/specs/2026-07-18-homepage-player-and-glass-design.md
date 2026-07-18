# Homepage Player and Glass Refinement Design

## Goal

Refine the homepage hero controls without changing the existing profile, education, archive, or page structure: use the user's nine supplied MP3 files as a local playlist; improve contact, search, lens, and music-control interactions.

## Playlist

- Copy the nine MP3 files from `/Users/yyy/Learning_material/music` into `assets/music/` using stable ASCII filenames.
- Use one native `HTMLAudioElement`; do not keep the synthesized Web Audio sound as a fallback.
- Each playlist entry contains `title`, `artist`, `mood`, `accent`, and `src`.
- The player loads no media until the user presses play. It displays the selected song title and artist before playback, and the currently playing song name while playback is active.
- Previous and next buttons have identical circular dimensions and use matching single-chevron icons. The center play/pause button remains visually dominant.
- The audio element uses volume `1` as requested and automatically advances after an ended track.

## Contact Card

- Clicking WeChat toggles its contact card open and closed.
- Clicking QQ displays the QQ value while retaining its direct QQ destination.
- Opening and closing use an anchored frosted card transition: opacity, scale, vertical movement, blur, and a short spring-like easing. The card is hidden from layout and assistive interaction when closed.

## Search

- The search form submits the raw user-entered keywords to Google at `https://www.google.com/search` in a new tab.
- Empty input does not open a tab; it receives focus and a visible invalid state.
- The desktop search surface is capped at 760px, preventing overlap with the lens; smaller breakpoints remain full-width.
- The surface uses a dark translucent glass layer, backdrop blur, a fine luminous border, and restrained hover/focus highlights.

## Memory Lens

- Preserve the existing phrase-cycling button and reduced-motion behavior.
- Replace the dial-like presentation with a frosted blue-grey camera lens: a muted outer glass shell, radial glass reflection, shallow inner iris, subtle edge bloom, and low-amplitude pointer parallax.
- Desktop layout reserves a dedicated right-side lane outside the 760px hero content. At tablet and mobile widths it returns to normal document flow.

## Verification

- Extend the Node static test suite for Google search, contact-toggle code, nine local tracks, native audio playback, symmetrical controls, and lens/search sizing.
- Verify desktop, tablet, and mobile layouts plus WeChat toggle, Google search validation, and audio display behavior in a local browser.
- Run the full Node test suite and `git diff --check` before committing.

## Constraints

- Keep all existing profile, education, archive, and primary hero content intact.
- Do not add a library or framework.
- The user has supplied the local audio files; they remain subject to the user's responsibility to hold any public-distribution rights.
