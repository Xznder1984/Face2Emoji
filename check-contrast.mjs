#!/usr/bin/env node
/**
 * WCAG 2.2 contrast check.
 *
 * Reads the colour tokens out of src/styles/tokens.css and computes the WCAG
 * contrast ratio for every foreground/background pair the project actually
 * uses. Text must reach 4.5:1, large text and non-text UI parts 3:1.
 *
 * Exits non-zero if any pair fails, so `npm test` fails too.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, 'src/styles/tokens.css');

/** Minimum ratio required by WCAG 2.2 for each kind of pair. */
const MIN_TEXT = 4.5;
const MIN_LARGE_OR_NONTEXT = 3;

/**
 * Every pair the design depends on. `min` is the WCAG requirement that applies
 * to that pair, and `why` explains what the colour is used for.
 */
const PAIRS = [
  { fg: 'ink', bg: 'paper', min: MIN_TEXT, why: 'body text on the page' },
  { fg: 'ink', bg: 'surface', min: MIN_TEXT, why: 'body text on cards' },
  { fg: 'ink', bg: 'tint', min: MIN_TEXT, why: 'button hover fill' },
  { fg: 'muted', bg: 'paper', min: MIN_TEXT, why: 'lede, captions, footer' },
  { fg: 'muted', bg: 'surface', min: MIN_TEXT, why: 'muted text on cards' },
  { fg: 'accent', bg: 'paper', min: MIN_TEXT, why: 'links and focus ring' },
  { fg: 'accent', bg: 'surface', min: MIN_TEXT, why: 'links on cards' },
  { fg: 'on-accent', bg: 'accent', min: MIN_TEXT, why: 'primary button label' },
  { fg: 'on-accent', bg: 'accent-hover', min: MIN_TEXT, why: 'primary button hover' },
  { fg: 'on-accent', bg: 'ink', min: MIN_TEXT, why: 'primary button active' },
  { fg: 'accent-hover', bg: 'paper', min: MIN_TEXT, why: 'link hover on the page' },
  { fg: 'error', bg: 'paper', min: MIN_TEXT, why: 'error messages' },
  { fg: 'error', bg: 'surface', min: MIN_TEXT, why: 'error messages on cards' },
  { fg: 'line', bg: 'paper', min: MIN_LARGE_OR_NONTEXT, why: 'control borders' },
  { fg: 'line', bg: 'surface', min: MIN_LARGE_OR_NONTEXT, why: 'control borders on cards' },
  { fg: 'on-stage', bg: 'stage', min: MIN_TEXT, why: 'emoji label on the dark panel' },
  { fg: 'on-stage-muted', bg: 'stage', min: MIN_TEXT, why: 'camera-off note on the dark panel' },
  { fg: 'face', bg: 'stage', min: MIN_LARGE_OR_NONTEXT, why: 'live SVG face and face-point dots' },
];

/** sRGB hex string to [r, g, b] in 0..1. */
function channels(hex) {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** WCAG relative luminance. */
function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readTokens(source) {
  const tokens = new Map();
  const pattern = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*(?:;|$)/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    tokens.set(match[1], match[2].toLowerCase());
  }
  return tokens;
}

const tokens = readTokens(readFileSync(tokensPath, 'utf8'));

const missing = new Set();
for (const pair of PAIRS) {
  if (!tokens.has(pair.fg)) missing.add(pair.fg);
  if (!tokens.has(pair.bg)) missing.add(pair.bg);
}
if (missing.size > 0) {
  console.error(`Missing tokens in tokens.css: ${[...missing].join(', ')}`);
  process.exit(1);
}

const rows = [];
let failures = 0;

for (const pair of PAIRS) {
  const fg = tokens.get(pair.fg);
  const bg = tokens.get(pair.bg);
  const value = ratio(fg, bg);
  const pass = value >= pair.min;
  if (!pass) failures += 1;
  rows.push({
    pair: `--${pair.fg} on --${pair.bg}`,
    fg,
    bg,
    ratio: value.toFixed(2),
    min: pair.min.toFixed(1),
    pass,
    why: pair.why,
  });
}

const nameWidth = Math.max(...rows.map((r) => r.pair.length));
const fgWidth = Math.max(...rows.map((r) => r.fg.length));
const bgWidth = Math.max(...rows.map((r) => r.bg.length));
const ratioWidth = Math.max(...rows.map((r) => r.ratio.length));

console.log('WCAG 2.2 contrast ratios, computed from src/styles/tokens.css\n');
console.log(
  `${'pair'.padEnd(nameWidth)}  ${'fg'.padEnd(fgWidth)}  ${'bg'.padEnd(bgWidth)}  ${'ratio'.padStart(ratioWidth)}  min   result`,
);
console.log('-'.repeat(nameWidth + fgWidth + bgWidth + ratioWidth + 20));
for (const row of rows) {
  console.log(
    `${row.pair.padEnd(nameWidth)}  ${row.fg.padEnd(fgWidth)}  ${row.bg.padEnd(bgWidth)}  ${row.ratio.padStart(ratioWidth)}  ${row.min}  ${row.pass ? 'pass' : 'FAIL'}  ${row.why}`,
  );
}

console.log(
  `\n${rows.length} pairs checked, ${failures} failed. ` +
    'Text needs 4.5:1; large text, borders and other UI parts need 3:1.',
);

if (failures > 0) {
  console.error('\nContrast check failed. Fix the tokens or the pair list before shipping.');
  process.exit(1);
}
