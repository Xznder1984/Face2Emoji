import { describe, expect, it } from 'vitest';

import { DEFAULT_HOLD_MS, matchRule, NEUTRAL_RULE, RULES, T } from '../rules';
import { features } from './helpers';

/**
 * One test per row of the rules table, plus the ordering tests. If a threshold
 * is retuned, these are the tests that show what it broke.
 */

const match = (overrides: Parameters<typeof features>[0]) => matchRule(features(overrides)).id;

describe('rule table', () => {
  it('has 22 rules and ends with an always-true fallback', () => {
    expect(RULES).toHaveLength(22);
    expect(NEUTRAL_RULE.id).toBe('neutral');
    expect(NEUTRAL_RULE.test(features())).toBe(true);
  });

  it('gives every rule a label, a search term, a hold and a unique id', () => {
    const ids = new Set<string>();
    for (const rule of RULES) {
      expect(rule.id).not.toBe('');
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.searchTerm.length).toBeGreaterThan(0);
      expect(rule.hold).toBeGreaterThan(0);
      expect(rule.emoji.length).toBeGreaterThan(0);
    }
  });

  it('1. matches blowing a kiss when the lips pucker and one eye closes', () => {
    expect(match({ pucker: 0.6, winkDiff: 0.5, blinkL: 0.6 })).toBe('blowing-a-kiss');
  });

  it('2. matches kissing on a pucker alone', () => {
    expect(match({ pucker: 0.6 })).toBe('kissing');
  });

  it('3. matches a tongue sticking out', () => {
    expect(match({ tongue: 0.4 })).toBe('tongue-out');
  });

  it('4. matches a wink when one eye closes far more than the other', () => {
    expect(match({ winkDiff: 0.5, blinkR: 0.6 })).toBe('winking');
  });

  it('5. matches a yawn on both eyes closing with the jaw open', () => {
    expect(match({ blink: 0.6, jaw: 0.5, blinkL: 0.6, blinkR: 0.6 })).toBe('yawning');
  });

  it('6. matches shock on a wide jaw, raised brows and wide eyes', () => {
    expect(match({ jaw: 0.7, browUp: 0.6, eyeWide: 0.4 })).toBe('shocked');
  });

  it('7. matches surprise without a frown in the way', () => {
    expect(match({ jaw: 0.4, browUp: 0.4, eyeWide: 0.4 })).toBe('surprised');
  });

  it('8. matches laughing on a smile with the jaw open and the eyes squinted', () => {
    expect(match({ smile: 0.5, jaw: 0.4, squint: 0.4 })).toBe('laughing');
  });

  it('9. matches a grin on a smile with the jaw open', () => {
    expect(match({ smile: 0.5, jaw: 0.4 })).toBe('grinning');
  });

  it('10. matches content on a long closed-eye hold with a slight smile', () => {
    expect(match({ blink: 0.7, smile: 0.2, blinkL: 0.7, blinkR: 0.7 })).toBe('content');
  });

  it('11. matches closed eyes on a long hold with no smile', () => {
    expect(match({ blink: 0.7, blinkL: 0.7, blinkR: 0.7 })).toBe('eyes-closed');
  });

  it('12. matches a warm smile on a smile with raised cheeks', () => {
    expect(match({ smile: 0.35, cheekSquint: 0.4 })).toBe('smiling-warmly');
  });

  it('13. matches a plain smile', () => {
    expect(match({ smile: 0.35 })).toBe('smiling');
  });

  it('14. matches crying on a frown with raised brows and an open jaw', () => {
    expect(match({ frown: 0.5, browUp: 0.5, jaw: 0.5 })).toBe('crying');
  });

  it('15. matches sadness on a frown with raised brows', () => {
    expect(match({ frown: 0.5, browUp: 0.5 })).toBe('sad');
  });

  it('16. matches a plain frown', () => {
    expect(match({ frown: 0.5 })).toBe('frowning');
  });

  it('17. matches disgust on a sneer with a raised upper lip', () => {
    expect(match({ sneer: 0.5, upperUp: 0.4 })).toBe('disgusted');
  });

  it('18. matches fury on strongly lowered brows with the jaw open', () => {
    expect(match({ browDown: 0.6, jaw: 0.3 })).toBe('furious');
  });

  it('19. matches anger on lowered brows with pressed lips', () => {
    expect(match({ browDown: 0.5, press: 0.3 })).toBe('angry');
  });

  it('20. matches a grimace on a stretched mouth', () => {
    expect(match({ stretch: 0.6 })).toBe('grimacing');
  });

  it('21. matches scepticism on one raised brow', () => {
    expect(match({ browDiff: 0.4 })).toBe('skeptical');
  });

  it('22. falls through to neutral on an unremarkable face', () => {
    expect(match({})).toBe('neutral');
  });
});

describe('rule order matters', () => {
  it('crying wins over surprised', () => {
    // Surprised needs a low frown. Crying needs a high one, and sits below it
    // in the table, so a real cry must not be read as surprise.
    expect(T.surpriseFrownMax).toBe(0.25);
    expect(match({ frown: 0.5, browUp: 0.5, jaw: 0.5 })).toBe('crying');
  });

  it('pressed lips with lowered brows is angry, not furious', () => {
    expect(match({ browDown: 0.45, press: 0.3 })).toBe('angry');
  });

  it('blowing a kiss wins over both kissing and winking', () => {
    expect(match({ pucker: 0.6, winkDiff: 0.5, blinkL: 0.6 })).toBe('blowing-a-kiss');
  });

  it('laughing wins over grinning', () => {
    expect(match({ smile: 0.5, jaw: 0.4, squint: 0.4 })).toBe('laughing');
  });

  it('shock wins over surprise', () => {
    expect(match({ jaw: 0.7, browUp: 0.6, eyeWide: 0.4 })).toBe('shocked');
  });

  it('winking wins over yawning when only one eye is shut', () => {
    expect(match({ winkDiff: 0.5, blinkR: 0.6 })).toBe('winking');
  });

  it('content wins over eyes closed when there is a slight smile', () => {
    expect(match({ blink: 0.7, smile: 0.2, blinkL: 0.7, blinkR: 0.7 })).toBe('content');
  });

  it('keeps the table in the documented order', () => {
    expect(RULES.map((rule) => rule.id)).toEqual([
      'blowing-a-kiss',
      'kissing',
      'tongue-out',
      'winking',
      'yawning',
      'shocked',
      'surprised',
      'laughing',
      'grinning',
      'content',
      'eyes-closed',
      'smiling-warmly',
      'smiling',
      'crying',
      'sad',
      'frowning',
      'disgusted',
      'furious',
      'angry',
      'grimacing',
      'skeptical',
      'neutral',
    ]);
  });
});

describe('hold times', () => {
  it('defaults to 200ms', () => {
    expect(DEFAULT_HOLD_MS).toBe(200);
  });

  it('gives a yawn, content and closed eyes longer holds', () => {
    const holdFor = (id: string) => RULES.find((rule) => rule.id === id)?.hold;
    expect(holdFor('yawning')).toBe(500);
    expect(holdFor('content')).toBe(600);
    expect(holdFor('eyes-closed')).toBe(600);
  });
});
