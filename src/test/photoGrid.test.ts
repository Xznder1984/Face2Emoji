// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import type { CacheState } from '../cache';
import { createPhotoGrid, photoStatusMessage } from '../ui/photoGrid';
import { photoFixture } from './fixtures/commons-response.json';

function ready(photos: unknown[] = [photoFixture]): CacheState {
  return {
    status: 'ready',
    term: 'yawning face',
    photos: photos as CacheState extends { photos: infer P } ? P : never,
  };
}

let container: HTMLElement;
let grid: ReturnType<typeof createPhotoGrid>;

beforeEach(() => {
  document.body.replaceChildren();
  container = document.createElement('div');
  document.body.append(container);
  grid = createPhotoGrid(container);
});

describe('createPhotoGrid', () => {
  it('renders nothing while there is nothing to show', () => {
    grid.render({ status: 'idle' });
    expect(container.children).toHaveLength(0);

    grid.render({ status: 'loading', term: 'yawning face' });
    expect(container.children).toHaveLength(0);

    grid.render({ status: 'error', term: 'yawning face', message: 'no' });
    expect(container.children).toHaveLength(0);

    grid.render(ready([]));
    expect(container.children).toHaveLength(0);
  });

  it('clears the previous expression before drawing the next', () => {
    grid.render(ready());
    expect(container.children).toHaveLength(1);

    grid.render({ status: 'idle' });
    expect(container.children).toHaveLength(0);
  });

  it('shows a figure per photo', () => {
    grid.render(ready());
    const figures = container.querySelectorAll('figure.photo');
    expect(figures).toHaveLength(1);
    expect(figures[0]?.querySelector('img')?.getAttribute('src')).toBe(photoFixture.thumbnail);
  });

  it('never shows more than six', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...photoFixture,
      title: `File:${index}.jpg`,
      pageUrl: `https://commons.wikimedia.org/wiki/File:${index}.jpg`,
    }));
    grid.render(ready(many));
    expect(container.querySelectorAll('figure.photo')).toHaveLength(6);
  });

  it('credits the creator and the licence, which is the whole point', () => {
    grid.render(ready());
    const text = container.textContent ?? '';
    expect(text).toContain('Example User');
    expect(text).toContain('CC BY-SA 4.0');
    expect(text).toContain('Licence and source');
  });

  it('says so plainly when a creator is not credited', () => {
    grid.render(ready([{ ...photoFixture, author: '' }]));
    expect(container.textContent).toContain('creator not credited');
  });

  it('leaves out the description when there is not one', () => {
    grid.render(ready());
    expect(container.querySelector('.photo-description')?.textContent).toBe(
      'A woman yawning. Taken in daylight.',
    );

    grid.render(ready([{ ...photoFixture, description: '' }]));
    expect(container.querySelector('.photo-description')).toBeNull();
  });

  it('points at the Commons page, never at the raw file', () => {
    grid.render(ready());
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).not.toContain(photoFixture.fileUrl);
    for (const href of links) {
      expect(href).toBe(photoFixture.pageUrl);
    }
  });

  it('opens every link safely', () => {
    grid.render(ready());
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('rel')).toBe('noreferrer');
      expect(new URL(link.getAttribute('href') ?? '').protocol).toBe('https:');
    }
  });

  it('gives the photo an accessible name through its caption, not the image', () => {
    grid.render(ready());
    const image = container.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('');

    // The image is out of the tab order and hidden from assistive technology,
    // so the caption and the numbered link carry the meaning.
    const thumbnailLink = container.querySelector('.photo-link');
    expect(thumbnailLink?.getAttribute('aria-hidden')).toBe('true');
    expect(thumbnailLink?.getAttribute('tabindex')).toBe('-1');

    const visit = container.querySelector('.photo-visit');
    expect(visit?.textContent).toBe('Photo 1 on Wikimedia Commons');
  });

  it('loads thumbnails lazily', () => {
    grid.render(ready());
    const image = container.querySelector('img');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('decoding')).toBe('async');
  });

  it('writes a hostile description as text and never as markup', () => {
    const hostile = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
    grid.render(ready([{ ...photoFixture, description: hostile }]));

    const description = container.querySelector('.photo-description');
    expect(description?.children).toHaveLength(0);
    expect(description?.innerHTML).not.toContain('<img');
    expect(description?.innerHTML).not.toContain('<b>');
    expect((window as unknown as Record<string, unknown>)['__pwned']).toBeUndefined();
  });

  it('numbers the results from one', () => {
    const many = Array.from({ length: 3 }, (_, index) => ({
      ...photoFixture,
      pageUrl: `https://commons.wikimedia.org/wiki/File:${index}.jpg`,
    }));
    grid.render(ready(many));
    const labels = Array.from(container.querySelectorAll('.photo-visit')).map((a) => a.textContent);
    expect(labels).toEqual([
      'Photo 1 on Wikimedia Commons',
      'Photo 2 on Wikimedia Commons',
      'Photo 3 on Wikimedia Commons',
    ]);
  });
});

describe('photoStatusMessage', () => {
  it('says nothing leaves the machine while lookup is off', () => {
    for (const state of [{ status: 'idle' }, { status: 'loading', term: 'a' }, ready()] as CacheState[]) {
      expect(photoStatusMessage(state, false)).toBe('Photo lookup is off. Nothing is sent to Wikimedia.');
    }
  });

  it('says it is working', () => {
    expect(photoStatusMessage({ status: 'loading', term: 'a' }, true)).toBe(
      'Looking for photos on Wikimedia Commons...',
    );
  });

  it('counts what came back', () => {
    expect(photoStatusMessage(ready([]), true)).toContain('no photos');
    expect(photoStatusMessage(ready([photoFixture]), true)).toContain('1 photo');
    expect(photoStatusMessage(ready([photoFixture, photoFixture]), true)).toContain('2 photos');
  });

  it('passes an error sentence straight through', () => {
    expect(
      photoStatusMessage({ status: 'error', term: 'a', message: 'Wikimedia is grumpy.' }, true),
    ).toBe('Wikimedia is grumpy.');
  });

  it('explains the on state before anything is searched', () => {
    expect(photoStatusMessage({ status: 'idle' }, true)).toBe(
      'Photo lookup is on. Short search phrases go to Wikimedia Commons.',
    );
  });
});
