// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createStatus } from '../ui/status';

function mount(): HTMLElement {
  const element = document.createElement('p');
  element.setAttribute('role', 'status');
  document.body.replaceChildren(element);
  return element;
}

describe('createStatus', () => {
  it('writes a message and reads it back', () => {
    const status = createStatus(mount());
    status.set('Camera is off.');
    expect(status.text()).toBe('Camera is off.');
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Camera is off.');
  });

  it('never re-writes identical text into the live region', () => {
    const element = mount();
    const status = createStatus(element);
    status.set('Camera is off.');

    let writes = 0;
    const observer = new MutationObserver((records) => {
      writes += records.length;
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });

    status.set('Camera is off.');
    status.set('Camera is off.');

    expect(writes).toBe(0);
    observer.disconnect();
  });

  it('marks errors with text as well as colour', () => {
    const element = mount();
    const status = createStatus(element);
    status.set('No camera was found. Plug one in, then press Start camera again.', 'error');
    expect(element.dataset['kind']).toBe('error');
    expect(element.textContent).toContain('No camera was found');

    status.set('Camera is off.');
    expect(element.dataset['kind']).toBeUndefined();
  });
});
