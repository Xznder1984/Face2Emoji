import { describe, expect, it } from 'vitest';

import {
  CAMERA_MESSAGES,
  CameraError,
  VIDEO_CONSTRAINTS,
  cameraErrorMessage,
  classifyCameraError,
} from '../camera';

const named = (name: string): Error => {
  const error = new Error('inner detail');
  error.name = name;
  return error;
};

describe('camera constraints', () => {
  it('asks for a 640 by 480 user-facing video and no microphone', () => {
    expect(VIDEO_CONSTRAINTS).toEqual({
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    });
  });
});

describe('classifyCameraError', () => {
  it('reads a blocked permission as not allowed', () => {
    for (const name of ['NotAllowedError', 'PermissionDeniedError', 'SecurityError']) {
      expect(classifyCameraError(named(name))).toBe('not-allowed');
    }
  });

  it('reads a missing device as not found', () => {
    for (const name of ['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError']) {
      expect(classifyCameraError(named(name))).toBe('not-found');
    }
  });

  it('reads a busy device as not readable', () => {
    for (const name of ['NotReadableError', 'TrackStartError']) {
      expect(classifyCameraError(named(name))).toBe('not-readable');
    }
  });

  it('falls back to unknown for anything else', () => {
    expect(classifyCameraError(new TypeError('boom'))).toBe('unknown');
    expect(classifyCameraError(undefined)).toBe('unknown');
    expect(classifyCameraError(null)).toBe('unknown');
  });

  it('reads a name off a plain object, the way Safari reports one', () => {
    expect(classifyCameraError({ name: 'NotAllowedError' })).toBe('not-allowed');
  });
});

describe('cameraErrorMessage', () => {
  it('uses the exact sentence for each known failure', () => {
    expect(cameraErrorMessage('not-allowed')).toBe(
      'Camera access was blocked. Allow the camera for this site in the address bar, then press Start camera again.',
    );
    expect(cameraErrorMessage('not-found')).toBe(
      'No camera was found. Plug one in, then press Start camera again.',
    );
    expect(cameraErrorMessage('not-readable')).toBe(
      'The camera is being used by another app. Close that app, then press Start camera again.',
    );
    expect(cameraErrorMessage('no-media-devices')).toContain('secure address');
  });

  it('says every known failure in one complete sentence with one instruction', () => {
    for (const message of Object.values(CAMERA_MESSAGES)) {
      if (message.includes('{message}')) continue;
      expect(message.endsWith('.')).toBe(true);
      expect(message.split('. ').filter(Boolean).length).toBeLessThanOrEqual(2);
    }
  });

  it('shows the underlying reason for an unknown failure', () => {
    expect(cameraErrorMessage('unknown', new Error('wasm missing'))).toBe(
      'Could not start: wasm missing. Check that the model files loaded.',
    );
  });

  it('unwraps a CameraError rather than printing the word unknown', () => {
    const wrapped = new CameraError('unknown', new Error('model download failed'));
    expect(cameraErrorMessage('unknown', wrapped)).toBe(
      'Could not start: model download failed. Check that the model files loaded.',
    );
    expect(cameraErrorMessage('unknown', wrapped)).not.toContain('unknown');
  });

  it('keeps the failure code and the original error on the CameraError', () => {
    const cause = new Error('root');
    const error = new CameraError('not-allowed', cause);
    expect(error.failure).toBe('not-allowed');
    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });
});
