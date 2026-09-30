import type { CommonsPhoto } from '../commons';
import type { CacheState } from '../cache';

/**
 * Rendering for the photo grid.
 *
 * Nothing is ever assigned from a string of HTML. Every node is built with
 * `document.createElement` and filled in with `textContent`, so a description
 * written by a Commons volunteer is shown as text and cannot become markup.
 */

const GRID_LIMIT = 6;

export interface PhotoGrid {
  /** Draw whatever the cache currently holds. */
  render(state: CacheState): void;
  /** Empty the grid without changing the status line. */
  clear(): void;
}

function figure(photo: CommonsPhoto, position: number): HTMLElement {
  const item = document.createElement('figure');
  item.className = 'photo';

  const link = document.createElement('a');
  link.className = 'photo-link';
  // `pageUrl` is built by us from the file title, not taken from the API.
  link.href = photo.pageUrl;
  link.rel = 'noreferrer';
  link.tabIndex = -1;
  link.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.className = 'photo-image';
  image.src = photo.thumbnail;
  image.alt = '';
  // Set as attributes rather than properties: both are reflected by the HTML
  // spec, but `loading` in particular is not implemented everywhere, and an
  // attribute is what the tests can see.
  image.setAttribute('loading', 'lazy');
  image.setAttribute('decoding', 'async');
  image.width = 320;
  image.height = 240;
  link.append(image);

  const caption = document.createElement('figcaption');
  caption.className = 'photo-caption';

  // The image itself is hidden from assistive technology and the link is not
  // focusable, so the caption is the whole accessible name for this result.
  const credit = document.createElement('span');
  credit.className = 'photo-credit';
  credit.textContent = photo.author ? `by ${photo.author}` : 'creator not credited';
  caption.append(credit, ' ');

  const licence = document.createElement('span');
  licence.className = 'photo-licence';
  licence.textContent = photo.licence;
  caption.append(licence, '. ');

  const licenceLink = document.createElement('a');
  licenceLink.className = 'photo-licence-link';
  licenceLink.href = photo.pageUrl;
  licenceLink.rel = 'noreferrer';
  licenceLink.textContent = 'Licence and source';
  caption.append(licenceLink);

  if (photo.description) {
    const description = document.createElement('p');
    description.className = 'photo-description';
    description.textContent = photo.description;
    item.append(description);
  }

  const visit = document.createElement('a');
  visit.className = 'photo-visit';
  visit.href = photo.pageUrl;
  visit.rel = 'noreferrer';
  visit.textContent = `Photo ${position + 1} on Wikimedia Commons`;

  item.append(link, caption, visit);
  return item;
}

export function createPhotoGrid(container: HTMLElement): PhotoGrid {
  return {
    render(state) {
      container.replaceChildren();

      if (state.status !== 'ready') return;

      const photos = state.photos.slice(0, GRID_LIMIT);
      if (photos.length === 0) return;

      for (const [index, photo] of photos.entries()) {
        container.append(figure(photo, index));
      }
    },

    clear() {
      container.replaceChildren();
    },
  };
}

/** The sentence for the photo status line, given what the cache is doing. */
export function photoStatusMessage(state: CacheState, lookupOn: boolean): string {
  if (!lookupOn) return 'Photo lookup is off. Nothing is sent to Wikimedia.';
  if (state.status === 'loading') return 'Looking for photos on Wikimedia Commons...';
  if (state.status === 'error') return state.message;
  if (state.status === 'ready') {
    const count = state.photos.length;
    if (count === 0) return `Wikimedia Commons has no photos for this expression.`;
    const plural = count === 1 ? 'photo' : 'photos';
    return `${count} ${plural} on Wikimedia Commons. Each one shows its creator and licence.`;
  }
  return 'Photo lookup is on. Short search phrases go to Wikimedia Commons.';
}
