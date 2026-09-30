import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks. These never touch a real camera: Chromium is launched
 * with `--use-fake-device-for-media-stream`, which replaces the device list
 * entirely with a synthetic video source, and with
 * `--use-fake-ui-for-media-stream`, which grants permission without a prompt.
 * No real capture device is ever enumerated or opened.
 *
 * These run against the production build served by `vite preview`, so the
 * Content-Security-Policy meta tag is the real one.
 *
 * Run with: npx playwright test
 */

const PORT = 4173;

export const FAKE_CAMERA_ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // The fake device is a synthetic pattern with no face in it, so every frame
  // goes through a full CPU inference and the page's main thread is saturated.
  // Give these checks room; they are not testing inference speed.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    permissions: ['camera'],
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: FAKE_CAMERA_ARGS,
    },
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
