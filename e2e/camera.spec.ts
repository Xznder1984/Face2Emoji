import { expect, test, type ConsoleMessage, type Locator, type Page, type Request } from '@playwright/test';

/**
 * The camera path, against Chromium's fake capture device. Nothing here opens
 * real hardware.
 *
 * Once the camera is running, every frame goes through a full inference against
 * a synthetic pattern that contains no face, and on a CPU delegate that blocks
 * the main thread. Playwright's actionability wait needs two stable animation
 * frames, which cannot happen while that is going on, so clicks made after the
 * camera starts are dispatched directly. Keyboard operability is tested
 * separately with the camera off, where the main thread is idle.
 */

interface Network {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  requests: string[];
}

/**
 * Console output that comes from the third-party runtime rather than from this
 * code, and that there is no supported way to change.
 *
 * The first is MediaPipe's bundled TensorFlow Lite runtime printing an
 * informational line to stderr, which its JavaScript glue forwards to
 * `console.error`.
 *
 * The second and third are the Content-Security-Policy refusing MediaPipe's own
 * attempt to reach `https://odml.pa.googleapis.com/v1/log`. That block is the
 * policy working as intended — nothing about a visitor's face should be able to
 * leave the machine — but the browser logs a refused connection either way.
 * They are allowlisted rather than silenced by widening `connect-src`, because
 * widening it would be the wrong trade.
 */
const KNOWN_THIRD_PARTY = [
  /^INFO: Created TensorFlow Lite XNNPACK delegate for CPU\.$/,
  /^Connecting to 'https:\/\/odml\.pa\.googleapis\.com\/v1\/log' violates the following Content Security Policy directive/,
  /^Fetch API cannot load https:\/\/odml\.pa\.googleapis\.com\/v1\/log\. Refused to connect because it violates the document's Content Security Policy\.$/,
];

/** Anything on the console that is not a known third-party message. */
function unexpected(messages: string[]): string[] {
  return messages.filter((text) => !KNOWN_THIRD_PARTY.some((pattern) => pattern.test(text)));
}

function watch(page: Page): Network {
  const log: Network = { consoleErrors: [], consoleWarnings: [], pageErrors: [], requests: [] };

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') log.consoleErrors.push(message.text());
    if (message.type() === 'warning') log.consoleWarnings.push(message.text());
  });
  page.on('pageerror', (error) => log.pageErrors.push(error.message));
  page.on('request', (request: Request) => log.requests.push(request.url()));

  return log;
}

async function press(locator: Locator): Promise<void> {
  await locator.evaluate((element) => (element as HTMLElement).click());
}

const PAGES = ['/', '/privacy.html', '/terms.html', '/404.html'];

test('every page loads with no console errors or warnings', async ({ page }) => {
  const log = watch(page);

  for (const path of PAGES) {
    await page.goto(path);
    await expect(page).toHaveTitle(/Face to Emoji|not found/);
  }

  expect(log.pageErrors).toEqual([]);
  expect(unexpected(log.consoleErrors)).toEqual([]);
  expect(log.consoleWarnings).toEqual([]);
});

test('the camera starts and stops cleanly, and every request is same-origin', async ({ page }) => {
  const log = watch(page);
  await page.goto('/');

  await expect(page.locator('#status')).toHaveText('Camera is off.');
  await expect(page.locator('#camera-note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start camera' })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Stop camera' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  await press(page.getByRole('button', { name: 'Start camera' }));

  await expect(page.locator('#status')).toContainText('Camera is on', { timeout: 120_000 });

  // The video is really running and really has pixels in it.
  const size = await page.locator('#preview').evaluate((video) => {
    const el = video as HTMLVideoElement;
    return { width: el.videoWidth, height: el.videoHeight, time: el.currentTime };
  });
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);
  expect(size.time).toBeGreaterThan(0);

  await expect(page.locator('#camera-note')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Stop camera' })).toHaveAttribute(
    'aria-disabled',
    'false',
  );

  await press(page.getByRole('button', { name: 'Stop camera' }));
  await expect(page.locator('#status')).toHaveText('Camera is off.');
  await expect(page.locator('#camera-note')).toBeVisible();
  await expect(page.locator('#preview')).toBeHidden();

  // Stopping must actually release the device.
  const stillAttached = await page.evaluate(() =>
    Array.from(document.querySelectorAll('video')).some(
      (video) => (video as HTMLVideoElement).srcObject !== null,
    ),
  );
  expect(stillAttached).toBe(false);

  // Nothing left the machine, and no model file came from a third party.
  const origin = new URL(page.url()).origin;
  const foreign = log.requests.filter((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return false;
    return new URL(url).origin !== origin;
  });
  expect(foreign).toEqual([]);

  expect(log.pageErrors).toEqual([]);
  expect(unexpected(log.consoleErrors)).toEqual([]);
});

test('setting a neutral face asks for a relaxed pose', async ({ page }) => {
  await page.goto('/');
  await press(page.getByRole('button', { name: 'Start camera' }));
  await expect(page.locator('#status')).toContainText('Camera is on', { timeout: 120_000 });

  // The fake device shows a colour pattern, not a face, so sampling cannot
  // finish on its own. What must be true is that the instruction is shown and
  // that the button reports that it is busy.
  await press(page.getByRole('button', { name: 'Set neutral face' }));
  await expect(page.locator('#status')).toHaveText('Hold a relaxed, neutral face for a second...');
  await expect(page.getByRole('button', { name: 'Set neutral face' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  await press(page.getByRole('button', { name: 'Stop camera' }));
  await expect(page.locator('#status')).toHaveText('Camera is off.');
});

test('the display radio swaps the emoji for a drawn face', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#emoji-roll')).toBeVisible();
  await expect(page.locator('#emoji-live')).toBeHidden();

  await page.getByRole('radio', { name: 'Live emoji face' }).check();
  await expect(page.locator('#emoji-live')).toBeVisible();
  await expect(page.locator('#emoji-roll')).toBeHidden();
  await expect(page.locator('#emoji-live svg')).toBeVisible();

  await page.getByRole('radio', { name: 'Match an emoji' }).check();
  await expect(page.locator('#emoji-roll')).toBeVisible();
  await expect(page.locator('#emoji-live')).toBeHidden();
});

test('holds together at 320 pixels wide', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');

  // Nothing scrolls sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The controls are still reachable and still meet the target size.
  for (const name of ['Start camera', 'Stop camera', 'Set neutral face']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // The radio group is still usable.
  await page.getByRole('radio', { name: 'Live emoji face' }).check();
  await expect(page.locator('#emoji-live')).toBeVisible();
});

test('still works at 200 percent zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.evaluate(() => {
    document.body.style.zoom = '200%';
  });

  await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible();
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('#status')).toContainText('Camera is on', { timeout: 120_000 });
});

test('honours reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const motion = await page.evaluate(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  expect(motion).toBe(true);

  // The app still runs; only the animation is dropped.
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('#status')).toContainText('Camera is on', { timeout: 120_000 });
});

test('a blocked camera shows the plain-language message', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    };
  });

  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('#status')).toHaveText(
    'Camera access was blocked. Allow the camera for this site in the address bar, then press Start camera again.',
  );
  expect(await page.locator('#status').getAttribute('data-kind')).toBe('error');
  await expect(page.getByRole('button', { name: 'Start camera' })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
});

test('an unavailable camera model reports a plain failure', async ({ page }) => {
  await page.goto('/');
  await page.route('**/face_landmarker.task', (route) => route.fulfill({ status: 404, body: '' }));

  await page.getByRole('button', { name: 'Start camera' }).click();

  const status = page.locator('#status');
  await expect(status).toHaveText(/^Could not start: /);

  // The message must name a real reason. If the failure code leaked through
  // instead of the underlying error, the text would read "Could not start:
  // unknown" and this would fail.
  const text = await status.textContent();
  expect(text).toMatch(/^Could not start: .+\. Check that the model files loaded\.$/);
  expect(text).not.toContain('unknown');
  expect(await status.getAttribute('data-kind')).toBe('error');

  // The camera never came up, so the note and the disabled state both stand.
  await expect(page.locator('#camera-note')).toBeVisible();
  await expect(page.locator('#preview')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start camera' })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
});
