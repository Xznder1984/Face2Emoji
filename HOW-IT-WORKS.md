# How it works

The whole pipeline runs in one tab. There is no server involved in recognizing a face.

```
webcam ──▶ video element ──▶ MediaPipe FaceLandmarker ──▶ 52 blendshape scores
                                                                    │
                                                                    ▼
                                              deriveFeatures() ──▶ 18 named signals
                                                                    │
                                                                    ▼
                                              smoothBlendshapes() ──▶ EMA
                                                                    │
                                                                    ▼
                                              applyCalibration() ──▶ measured against your neutral
                                                                    │
                                                                    ▼
                                              matchRule() ──▶ the first rule that is true
                                                                    │
                                                                    ▼
                                              stepSettle() ──▶ held for its hold time
                                                                    │
                                                      ┌─────────────┴─────────────┐
                                                      ▼                           ▼
                                              emoji + label              drawn face + tilt
```

## The model

[MediaPipe FaceLandmarker](https://github.com/google-ai-edge/mediapipe) finds 478 landmarks and
reports 52 **blendshapes** — named movements such as `mouthSmileLeft`, `eyeBlinkRight` and
`jawOpen`, each scored from 0 to 1. The model and its WASM runtime are served from `public/mediapipe/`,
so loading them makes no third-party request.

The GPU delegate is tried first and the CPU delegate is the fallback, so the app still runs on a
machine with no usable GPU. Which one you are on is in the status line.

## From 52 scores to 18 signals

`src/features.ts` averages the left and right scores for symmetric movements, so `mouthSmileLeft` and
`mouthSmileRight` become one `smile`. It also derives a few the rules need directly: `browDiff` is
the difference between the two outer brows, and `winkDiff` the difference between the two blinks,
which is what tells a wink from a blink.

## Smoothing and calibration

`src/smoothing.ts` does two things.

**An exponential moving average** over every signal, so one noisy frame cannot move the answer. The
factor is a named constant.

**A neutral calibration.** Pressing **Set neutral face** records what your relaxed face scores over
about a second, and every later frame is measured against it. This is the difference between "your
face is smiling" and "your face is smiling *more than yours usually does*". The calibration is held
in memory for the session and is gone on reload.

## The rules

`src/rules.ts` holds 22 rules in order. The first whose condition is true wins, so the list runs from
most specific to least: blowing a kiss is checked before kissing, and a wink before a yawn. A general
rule placed high up would swallow the specific ones below it.

Every threshold is a named constant in `T`, and every rule has a `hold` time. **None of these numbers
has been checked against a real face.** They are starting points to be tuned with the live readings
panel, not settled values.

## The hold time

`src/settle.ts` is a small state machine. A rule that starts winning does not change the display; it
has to stay the winner for that rule's `hold` milliseconds first. A long-hold rule is not pre-empted by
a short-hold one that flickers past. This is what stops an ordinary blink, which lasts about 100 ms,
from flickering the display to "Eyes closed" while a real 600 ms closed-eye hold still gets through.

## Head tilt

`src/roll.ts` takes the two outer eye corners, 33 and 263, and measures the angle of the line between
them. The sign is negated because the preview is mirrored. The result is clamped to ±45° and
smoothed, or set directly under `prefers-reduced-motion`.

## The drawn face

`src/ui/liveFace.ts` draws an SVG face from the same smoothed signals the rules read. Eyes close on
a blink and widen on an eye-wide signal, brows lift and lower, and the mouth curves, opens, puckers
and stretches. It is a second display, not a second tracker, so it costs no extra inference.

## Photos

`src/commons.ts` asks the Wikimedia Commons API for files matching a fixed phrase from the rule list.
`src/cache.ts` holds one search per expression per session, abandons the previous request when the
expression changes, and never has more than three open. `src/ui/photoGrid.ts` renders the results.

A photo is shown only when it has an `https:` thumbnail on `upload.wikimedia.org` and a licence on the
list of free licences. Volunteer-supplied text is parsed with `DOMParser` and reduced to
`textContent`, so a description can be shown but cannot become markup.

## What is not done

- **No face is stored, uploaded or recorded.** Frames go into the model and come out as numbers.
- **No real-camera accuracy check.** The end-to-end tests use Chromium's fake capture device, so the
  thresholds are unverified against real faces. That is the first thing to do with a real webcam.
- **No accounts, no cookies, no analytics.**
