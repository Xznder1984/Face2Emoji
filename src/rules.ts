import type { Features } from './features';

/**
 * The ordered rule list.
 *
 * The first rule whose condition is true wins, so the list runs from most
 * specific to least: blowing a kiss is checked before kissing, and a wink is
 * checked before a yawn. A general rule high up would swallow the specific ones
 * below it.
 *
 * Every number is a named constant because none of these thresholds has been
 * checked against a real face. They are here to be tuned with the live readings
 * panel, not to be treated as settled.
 */

/** How long a rule must stay the winner before the emoji switches. */
export const DEFAULT_HOLD_MS = 200;

export const T = {
  kissPucker: 0.5,
  kissWinkDiff: 0.4,
  kissingPucker: 0.55,
  tongueOut: 0.35,
  winkDiff: 0.45,
  winkBlink: 0.55,
  yawnBlink: 0.55,
  yawnJaw: 0.4,
  shockJaw: 0.6,
  shockBrowUp: 0.5,
  shockEyeWide: 0.3,
  surpriseJaw: 0.3,
  surpriseFrownMax: 0.25,
  surpriseBrowUp: 0.35,
  surpriseEyeWide: 0.35,
  laughSmile: 0.45,
  laughJaw: 0.3,
  laughSquint: 0.3,
  grinSmile: 0.45,
  grinJaw: 0.3,
  contentBlink: 0.65,
  contentSmile: 0.15,
  closedBlink: 0.65,
  warmSmile: 0.3,
  warmCheekSquint: 0.35,
  smile: 0.3,
  cryFrown: 0.3,
  cryBrowUp: 0.3,
  cryJaw: 0.3,
  sadFrown: 0.3,
  sadBrowUp: 0.3,
  frown: 0.4,
  disgustSneer: 0.45,
  disgustUpperUp: 0.3,
  furiousBrowDown: 0.55,
  furiousJaw: 0.25,
  angryBrowDown: 0.4,
  angryPress: 0.2,
  angrySneer: 0.2,
  angryFrown: 0.2,
  grimaceStretch: 0.5,
  skepticalBrowDiff: 0.35,
} as const;

export interface Rule {
  /** Stable id, used by tests and by the photo cache. */
  id: string;
  emoji: string;
  label: string;
  /** The short phrase sent to Wikimedia Commons, and only when opted in. */
  searchTerm: string;
  /** Milliseconds this rule must stay the winner before the emoji switches. */
  hold: number;
  test(features: Features): boolean;
}

/**
 * Order matters. Do not reorder without re-running the rule ordering tests in
 * `src/test/rules.test.ts`.
 */
export const RULES: readonly Rule[] = [
  {
    id: 'blowing-a-kiss',
    emoji: '\u{1F618}',
    label: 'Blowing a kiss',
    searchTerm: 'blowing a kiss',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.pucker > T.kissPucker && f.winkDiff > T.kissWinkDiff,
  },
  {
    id: 'kissing',
    emoji: '\u{1F617}',
    label: 'Kissing',
    searchTerm: 'kissing face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.pucker > T.kissingPucker,
  },
  {
    id: 'tongue-out',
    emoji: '\u{1F61B}',
    label: 'Tongue out',
    searchTerm: 'tongue out face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.tongue > T.tongueOut,
  },
  {
    id: 'winking',
    emoji: '\u{1F609}',
    label: 'Winking',
    searchTerm: 'winking face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.winkDiff > T.winkDiff && Math.max(f.blinkL, f.blinkR) > T.winkBlink,
  },
  {
    id: 'yawning',
    emoji: '\u{1F971}',
    label: 'Yawning',
    searchTerm: 'yawning face',
    hold: 500,
    test: (f) => f.blink > T.yawnBlink && f.jaw > T.yawnJaw,
  },
  {
    id: 'shocked',
    emoji: '\u{1F631}',
    label: 'Shocked',
    searchTerm: 'shocked face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.jaw > T.shockJaw && f.browUp > T.shockBrowUp && f.eyeWide > T.shockEyeWide,
  },
  {
    id: 'surprised',
    emoji: '\u{1F62E}',
    label: 'Surprised',
    searchTerm: 'surprised face',
    hold: DEFAULT_HOLD_MS,
    test: (f) =>
      f.jaw > T.surpriseJaw &&
      f.frown < T.surpriseFrownMax &&
      (f.browUp > T.surpriseBrowUp || f.eyeWide > T.surpriseEyeWide),
  },
  {
    id: 'laughing',
    emoji: '\u{1F606}',
    label: 'Laughing',
    searchTerm: 'laughing face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.smile > T.laughSmile && f.jaw > T.laughJaw && f.squint > T.laughSquint,
  },
  {
    id: 'grinning',
    emoji: '\u{1F604}',
    label: 'Grinning',
    searchTerm: 'grinning face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.smile > T.grinSmile && f.jaw > T.grinJaw,
  },
  {
    id: 'content',
    emoji: '\u{1F60C}',
    label: 'Content',
    searchTerm: 'content relaxed face',
    hold: 600,
    test: (f) => f.blink > T.contentBlink && f.smile > T.contentSmile,
  },
  {
    id: 'eyes-closed',
    emoji: '\u{1F634}',
    label: 'Eyes closed',
    searchTerm: 'sleeping face',
    hold: 600,
    test: (f) => f.blink > T.closedBlink,
  },
  {
    id: 'smiling-warmly',
    emoji: '\u{1F60A}',
    label: 'Smiling warmly',
    searchTerm: 'smiling face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.smile > T.warmSmile && f.cheekSquint > T.warmCheekSquint,
  },
  {
    id: 'smiling',
    emoji: '\u{1F642}',
    label: 'Smiling',
    searchTerm: 'smiling face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.smile > T.smile,
  },
  {
    id: 'crying',
    emoji: '\u{1F62D}',
    label: 'Crying',
    searchTerm: 'crying face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.frown > T.cryFrown && f.browUp > T.cryBrowUp && f.jaw > T.cryJaw,
  },
  {
    id: 'sad',
    emoji: '\u{1F622}',
    label: 'Sad',
    searchTerm: 'sad face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.frown > T.sadFrown && f.browUp > T.sadBrowUp,
  },
  {
    id: 'frowning',
    emoji: '\u{1F641}',
    label: 'Frowning',
    searchTerm: 'frowning face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.frown > T.frown,
  },
  {
    id: 'disgusted',
    emoji: '\u{1F922}',
    label: 'Disgusted',
    searchTerm: 'disgusted face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.sneer > T.disgustSneer && f.upperUp > T.disgustUpperUp,
  },
  {
    id: 'furious',
    emoji: '\u{1F621}',
    label: 'Furious',
    searchTerm: 'furious face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.browDown > T.furiousBrowDown && f.jaw > T.furiousJaw,
  },
  {
    id: 'angry',
    emoji: '\u{1F620}',
    label: 'Angry',
    searchTerm: 'angry face',
    hold: DEFAULT_HOLD_MS,
    test: (f) =>
      f.browDown > T.angryBrowDown &&
      (f.press > T.angryPress || f.sneer > T.angrySneer || f.frown > T.angryFrown),
  },
  {
    id: 'grimacing',
    emoji: '\u{1F62C}',
    label: 'Grimacing',
    searchTerm: 'grimacing face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.stretch > T.grimaceStretch,
  },
  {
    id: 'skeptical',
    emoji: '\u{1F928}',
    label: 'Skeptical',
    searchTerm: 'raised eyebrow face',
    hold: DEFAULT_HOLD_MS,
    test: (f) => f.browDiff > T.skepticalBrowDiff,
  },
  {
    id: 'neutral',
    emoji: '\u{1F610}',
    label: 'Neutral',
    searchTerm: 'neutral face expression',
    hold: DEFAULT_HOLD_MS,
    test: () => true,
  },
];

/** The last rule is the fallback, so it always matches. */
export const NEUTRAL_RULE: Rule = RULES[RULES.length - 1] as Rule;

/** The first rule whose condition is true. */
export function matchRule(features: Features): Rule {
  for (const rule of RULES) {
    if (rule.test(features)) return rule;
  }
  return NEUTRAL_RULE;
}

export function ruleById(id: string): Rule | undefined {
  return RULES.find((rule) => rule.id === id);
}
