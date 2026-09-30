import type { Features } from '../features';

/**
 * The live readings panel: the tuning tool.
 *
 * It shows the eight strongest smoothed signals, as a name, a meter and a
 * number. Every rule threshold in `rules.ts` was guessed, and this table is how
 * a real face is compared against those guesses.
 *
 * It refreshes about eight times a second, and only while the panel is open,
 * because rebuilding a table thirty times a second for a closed panel is
 * wasted work.
 */

export const REFRESH_MS = 125;
export const ROW_COUNT = 8;

/** Signal names in a stable order, so ties do not shuffle between frames. */
const SIGNALS: ReadonlyArray<keyof Features> = [
  'smile',
  'frown',
  'jaw',
  'browUp',
  'browDown',
  'blink',
  'eyeWide',
  'squint',
  'cheekSquint',
  'pucker',
  'press',
  'stretch',
  'sneer',
  'upperUp',
  'tongue',
  'blinkL',
  'blinkR',
  'browDiff',
  'winkDiff',
];

export interface Readings {
  /** Feed the current frame. Cheap to call every frame; it throttles itself. */
  update(features: Features, now: number): void;
}

interface Row {
  tr: HTMLElement;
  name: HTMLElement;
  meter: HTMLMeterElement;
  value: HTMLElement;
}

export function createReadings(details: HTMLDetailsElement, body: HTMLElement): Readings {
  const rows: Row[] = [];
  for (let i = 0; i < ROW_COUNT; i += 1) {
    const tr = document.createElement('tr');

    const nameCell = document.createElement('td');
    const name = document.createElement('span');
    nameCell.append(name);

    const meterCell = document.createElement('td');
    const meter = document.createElement('meter');
    meter.min = 0;
    meter.max = 1;
    meter.value = 0;
    meterCell.append(meter);

    const valueCell = document.createElement('td');
    const value = document.createElement('span');
    valueCell.append(value);

    tr.append(nameCell, meterCell, valueCell);
    rows.push({ tr, name, meter, value });
  }
  body.replaceChildren(...rows.map((row) => row.tr));

  let lastDraw = -Infinity;

  return {
    update(features: Features, now: number): void {
      if (!details.open) return;
      if (now - lastDraw < REFRESH_MS) return;
      lastDraw = now;

      const ranked = SIGNALS.map((signal) => [signal, features[signal]] as const).sort(
        (a, b) => b[1] - a[1],
      );

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] as Row;
        const entry = ranked[i];
        if (!entry) continue;
        const [signal, value] = entry;
        row.name.textContent = signal;
        row.meter.value = value;
        row.meter.setAttribute('aria-label', `${signal} level`);
        row.value.textContent = value.toFixed(2);
      }
    },
  };
}
