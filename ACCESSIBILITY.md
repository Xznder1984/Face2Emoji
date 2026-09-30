# Accessibility

What was built to make this usable, and what a visitor can rely on.

## Getting around

- **Skip link.** "Skip to the app" is the first thing on the page and lands on `<main>`.
- **Every control is reachable by keyboard.** The buttons, the checkbox, the radio group and the
  `<details>` panel are all native elements in a sensible tab order.
- **Buttons use `aria-disabled`, not `disabled`.** A disabled button cannot be focused, and a
  visitor who tabs to "Stop camera" while it is off deserves to be told why rather than find a dead
  stop. The click produces an honest status message instead.
- **The focus ring is 3 px with a 3 px offset**, so it is visible against both the dark stage and
  the light page.

## Being told what is happening

- **Two separate live regions.** The expression label is `aria-live="polite"` and the status line is
  `role="status"`. A status message never interrupts the matched label, and the label is announced on
  its own.
- **Both refuse to re-write identical text**, so a screen reader does not repeat itself when a value
  has not changed.
- **Errors are announced as text, not by colour alone.** The status line carries a `data-kind`
  attribute that changes its colour, and the words themselves say what to do next.
- **The emoji glyph and the drawn face are `aria-hidden`.** The label beside them already names the
  expression, and a screen reader should not read a decorative glyph out loud.
- **The camera preview is `aria-hidden`.** It is a mirror, not information.
- **The photo images have empty `alt` and their links are not focusable.** The caption carries the
  accessible name — creator, licence and a link to the source — so the meaning is available without
  the image.

## Reading

- **Body text is 18 px and the label is 19 px**, with a line length capped by the measure.
- **Colour is never the only signal.** The status line's kind is in its text, the expression is in
  words, and the readings panel is a real table with a caption and `scope="col"` headers.
- **The readings panel is a `<details>`**, so it is closed by default and does not add noise.

## Colour contrast

`npm test` runs `check-contrast.mjs` over 18 colour pairs and fails the build if any of them drops
below its target. Text needs 4.5:1; large text, borders and other UI parts need 3:1. All 18 pass:

| Pair | Ratio | Min | What it is |
| --- | --- | --- | --- |
| `--ink` on `--paper` | 14.42:1 | 4.5 | body text on the page |
| `--ink` on `--surface` | 16.54:1 | 4.5 | body text on cards |
| `--muted` on `--paper` | 6.94:1 | 4.5 | lede, captions, footer |
| `--muted` on `--surface` | 7.96:1 | 4.5 | muted text on cards |
| `--accent` on `--paper` | 6.28:1 | 4.5 | links and the focus ring |
| `--on-accent` on `--accent` | 7.21:1 | 4.5 | primary button label |
| `--on-accent` on `--accent-hover` | 10.13:1 | 4.5 | primary button hover |
| `--error` on `--paper` | 6.60:1 | 4.5 | error messages |
| `--line` on `--paper` | 3.18:1 | 3.0 | control borders |
| `--line` on `--surface` | 3.65:1 | 3.0 | control borders on cards |
| `--on-stage` on `--stage` | 15.20:1 | 4.5 | emoji label on the dark panel |
| `--on-stage-muted` on `--stage` | 9.18:1 | 4.5 | camera-off note on the dark panel |
| `--face` on `--stage` | 11.46:1 | 3.0 | live SVG face and face-point dots |

The remaining five pairs are in `check-contrast.mjs`, which reads the tokens from
`src/styles/tokens.css` and prints the whole table.

## Motion

- **The emoji pop is 140 ms and the drawn face moves over 90–120 ms**, both short enough to feel
  responsive without being distracting.
- **Under `prefers-reduced-motion` the pop is skipped, the face transitions are dropped, and head tilt
  is direct 1:1 rotation** rather than eased.
- **Nothing moves unless something changed.** The status line and the label both refuse to re-write
  identical text.

## Layout

- **The layout holds at 320 px.** The panels stack, the controls wrap, and nothing scrolls sideways.
- **The emoji scales with `clamp()`**, so it is large on a desktop and still fits on a phone.
- **Targets are at least 44 px.** The buttons, the checkbox and the radio labels all meet it.
- **The app works at 200% zoom and with the text resized**, because nothing is positioned in a way
  that depends on an exact pixel width.

## Known gaps

- **The photo grid is a list of figures without a landmark role.** A screen reader hears the captions
  and the links, which carry the meaning, but the grid itself is not announced as a region.
- **The live readings table rebuilds its rows at 8 Hz.** A screen reader user with the panel open will
  hear frequent updates. The panel is closed by default, which limits this.
- **The drawn face is decorative by design.** A visitor who cannot see it loses nothing, because the
  label says the same thing, but there is no textual description of the face's current pose beyond
  the expression name.
- **No real-camera accuracy check has been done**, so whether the thresholds suit every face is
  unverified.
