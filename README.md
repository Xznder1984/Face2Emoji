# Face to Emoji

Point a webcam at your face and see the closest matching emoji. The camera frames are read in your
browser tab and are never uploaded, stored or recorded.

## Run it

You need Node 20.19 or newer.

```sh
npm install
python3 run.py
```

Then open <http://127.0.0.1:4173/>. The address has to be `localhost` or `https://` — a browser will
not hand a camera to a page opened from a file.

`run.py` can also do `dev`, `build`, `test` and `e2e`. `npm run dev` and `npm run preview` work too.

## What it does

Press **Start camera** and the page loads a face model, starts the webcam, and matches what it sees
against 22 ordered rules. The first rule whose condition is true wins, and a rule has to stay the
winner for its own hold time before the emoji changes, so an ordinary blink does not flicker the
display to "Eyes closed".

Three things shape the result:

- **Smoothing.** Each blendshape is an exponential moving average, so a single noisy frame cannot
  move the answer.
- **A neutral calibration.** **Set neutral face** records what *your* relaxed face scores, and
  every later frame is measured against it. Without this, a resting face that happens to smile
  slightly would read as "Smiling".
- **A hold time.** Each rule has one, longer for expressions that are easy to hold by accident.

The **Display** options switch between a plain emoji and a drawn face that mirrors you. The drawn
face reads the same signals as the rules, so the two can never disagree.

**Live readings** is the tuning tool: the eight strongest signals in the current frame, refreshed at
8 Hz while the panel is open. Every threshold in `src/rules.ts` is a named constant, and none of
them has been checked against a real face — tune them here.

## Photos

**Show photos of this expression** is off by default, because it is the one feature that sends
anything to anyone. Turn it on and a short fixed phrase from the rule list — never a face, a
landmark, or anything derived from a frame — goes to Wikimedia Commons, along with the IP address
every request carries. Results are cached for the session, so holding a pose costs one request, and
switching expression abandons the previous one.

Photos come from volunteers and are not reviewed. Each one shows its creator and licence; check the
licence before you reuse it.

## Privacy

- Frames go from the video element into the model and come back out as numbers. Nothing is stored,
  copied out, uploaded or recorded.
- The model runs in a worker, so a slow inference never freezes the page.
- The neutral calibration is memory only. There is no stored biometric sample to leak.
- The model and its WASM runtime are served from this origin, so loading them makes no third-party
  request.
- There are no cookies, no analytics and no build step that phones home.
- The only outgoing request is the optional photo search, and only when you ask for it.

See [Privacy](privacy.html) for the full statement and [Terms](terms.html) for the terms.

## Tests

```sh
npm test       unit tests and the colour-contrast check
npm run test:e2e   Playwright checks against Chromium's fake capture device
```

The end-to-end checks never open a real camera. They launch Chromium with
`--use-fake-device-for-media-stream`, which replaces the device list with a synthetic video source,
so no real capture device is ever enumerated or opened.

## Licence

The app is yours to do what you like with. Face tracking is by
[MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0). Photos are from
[Wikimedia Commons](https://commons.wikimedia.org/) and remain under their own licences. See
[CREDITS](CREDITS.md).
