# Credits

Every third-party thing in this project, with the licence read from the source rather than from
memory. Nothing here is bundled without a licence to point at.

## Runtime code

| Name | Version | Source | Licence | Used for |
| --- | --- | --- | --- | --- |
| `@mediapipe/tasks-vision` (MediaPipe Tasks Vision) | 1.0.1 (exact) | <https://www.npmjs.com/package/@mediapipe/tasks-vision> | Apache-2.0 | Face landmark and blendshape inference, in the browser |
| MediaPipe project licence text | as published | <https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE> | Apache-2.0 (with a permissive notice for some bundled `utf/` utilities) | Licence for the above |

The npm tarball does not ship a `LICENSE` file, so the licence was read from the upstream
repository at the URL above. `package.json` in the tarball also declares `"license": "Apache-2.0"`.

## Model

| Name | Version | Source | Licence | Used for |
| --- | --- | --- | --- | --- |
| MediaPipe Face Landmarker (`face_landmarker.task`) | float16/1 | <https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task> | **Not stated upstream** | The face landmark and blendshape model |

**The licence for the model weights is not stated anywhere that could be found.** The MediaPipe
solution pages carry only a documentation licence in their footer (page text CC-BY-4.0, code samples
Apache-2.0). Some sibling MediaPipe model cards, for example the Face Mesh V2 card at
<https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf>,
do say "LICENSED UNDER Apache License, Version 2.0", but no equivalent card could be found for
Face Landmarker.

Because unclear terms are not a basis for redistribution, **the model file is not committed to this
repository.** `fetch-assets.mjs` downloads it during `npm install` and records its SHA-256 in
`assets.lock.json`, and a changed hash fails the install loudly.

The WebAssembly runtime files in the same folder come out of the installed
`@mediapipe/tasks-vision` package and are covered by the Apache-2.0 licence above.

## Images shown to the visitor

| Name | Source | Licence | Used for |
| --- | --- | --- | --- |
| Wikimedia Commons file pages and thumbnails | <https://commons.wikimedia.org/> | Varies per file: free licence or public domain, named in `LicenseShortName` | The optional photo panel |

Each photo is displayed with its own creator and licence name, and links to the licence and to the
original file page. Results without a licence name are dropped, so nothing is shown that the app
cannot attribute.

## Typefaces and artwork

| Name | Source | Licence | Used for |
| --- | --- | --- | --- |
| System UI fonts (Bahnschrift, Segoe UI Variable Text, Avenir Next, and the platform's own defaults) | Shipped with the operating system | Whatever the operating system's licence says | Body text |
| Platform emoji font (Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji) | Shipped with the operating system | Whatever the operating system's licence says | The 22 matched emoji |

No font file, emoji image or icon set is bundled with this project, so there is nothing extra to
attribute and nothing extra is fetched from a third party. No icon library is used.

`favicon.svg` and the live emoji face in `liveFace.ts` are original drawings made for this project.
They are not copied, traced or adapted from any vendor's emoji artwork.
