import { PHOTOS_DEFAULT_ON } from '../config';
import { createStatus } from './ui/status';

/**
 * Page bootstrap. The markup in index.html is complete and usable on its own;
 * this file only adds behaviour and finds the elements it needs.
 */

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}

const statusEl = need<HTMLElement>('#status');
const photoStatusEl = need<HTMLElement>('#photo-status');
const photosToggle = need<HTMLInputElement>('#photos-toggle');

const status = createStatus(statusEl);
const photoStatus = createStatus(photoStatusEl);

// Photo lookup ships off. Nothing leaves the device unless the visitor says so.
photosToggle.checked = PHOTOS_DEFAULT_ON;
photoStatus.set(
  PHOTOS_DEFAULT_ON
    ? 'Photo lookup is on. Short search phrases go to Wikimedia Commons.'
    : 'Photo lookup is off. Nothing is sent to Wikimedia.',
);

photosToggle.addEventListener('change', () => {
  photoStatus.set(
    photosToggle.checked
      ? 'Photo lookup is on. Short search phrases go to Wikimedia Commons.'
      : 'Photo lookup is off. Nothing is sent to Wikimedia.',
  );
});

status.set('Camera is off.');
