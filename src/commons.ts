/**
 * Wikimedia Commons photo lookup.
 *
 * This is the only part of the app that talks to anyone, and it only runs when
 * the visitor has ticked the box. What leaves the machine is a short fixed
 * phrase from `rules.ts` — never a face, a landmark, or anything derived from a
 * frame — plus the IP address every web request carries.
 *
 * Results come from the public MediaWiki action API. No key is needed and
 * nothing is written anywhere.
 */

export const API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

/** Namespace 6 is File:, which is where the photographs live. */
export const FILE_NAMESPACE = 6;

/** How many results to ask for. The grid shows six. */
export const RESULT_LIMIT = 6;

/** Thumbnail width in pixels, and therefore roughly how big the request is. */
export const THUMBNAIL_WIDTH = 320;

/**
 * The licence short names Commons uses for files that are free to reuse.
 *
 * A file is shown only when its licence is on this list, because "freely
 * licensed" is a claim the grid has to be able to show evidence for. The list
 * is matched case-insensitively against the whole name, so `CC BY-SA 4.0`,
 * `CC0`, `Public domain` and `Apache License 2.0` all pass while `Fair use`,
 * `All rights reserved` and a blank field do not.
 *
 * `Public domain` and `CC0` are on the list deliberately: they are the most
 * free licences Commons offers, and an early version of this filter accepted
 * only names containing "cc", which threw them away and left the grid empty.
 */
const FREE_LICENCES: readonly string[] = [
  'cc0',
  'cc by',
  'cc-by',
  'public domain',
  'no restrictions',
  'copyrighted free use',
  'apache license',
  'mit',
  'lgpl',
  'gpl',
  'ofl',
];

/** A restriction that makes a Creative Commons licence not free to reuse. */
const RESTRICTIONS: readonly string[] = [
  '-nc',
  ' nc',
  'non-commercial',
  'noncommercial',
  '-nd',
  ' nd',
  'no derivatives',
  'noderivs',
];

/** True when a licence short name is one a visitor may reuse. */
export function isFreeLicence(name: string): boolean {
  const normalised = name.trim().toLowerCase();
  if (!normalised) return false;
  // `CC BY-NC 4.0` contains "cc by", so the restriction has to be checked first.
  if (RESTRICTIONS.some((restriction) => normalised.includes(restriction))) return false;
  return FREE_LICENCES.some((licence) => normalised.includes(licence));
}

/** Host for thumbnails. Anything else is dropped rather than rendered. */
const THUMBNAIL_HOST = 'upload.wikimedia.org';

/** Host for the "read more" links, which point at the Commons description page. */
const PAGE_HOST = 'commons.wikimedia.org';

export interface CommonsPhoto {
  /** Commons page title, e.g. `File:Example.jpg`. */
  title: string;
  /** A small, safe-to-render image on upload.wikimedia.org. */
  thumbnail: string;
  /** The full-size file, only used behind a deliberate link. */
  fileUrl: string;
  /** The Commons description page. */
  pageUrl: string;
  /** `CC BY-SA 4.0`, `Public domain`, and so on. */
  licence: string;
  /** `https://creativecommons.org/licenses/by-sa/4.0` when there is one. */
  licenceUrl: string;
  /** Who made it. May be blank. */
  author: string;
  /** A one-line description. May be blank. */
  description: string;
}

export interface CommonsSearchOptions {
  signal?: AbortSignal;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Build the request URL. Exported so the exact query can be asserted in tests. */
export function searchUrl(term: string, limit = RESULT_LIMIT): string {
  const url = new URL(API_ENDPOINT);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    // Search inside File: only, so results are photographs rather than articles.
    gsrnamespace: String(FILE_NAMESPACE),
    gsrsearch: term,
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: String(THUMBNAIL_WIDTH),
    iiextmetadatafilter:
      'LicenseShortName|LicenseUrl|Artist|ImageDescription|ObjectName|Categories',
  }).toString();
  return url.toString();
}

/** Only `https:` URLs on the two Wikimedia hosts we expect are allowed through. */
export function safeUrl(value: unknown, hosts: readonly string[]): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!hosts.includes(url.hostname)) return null;
  return url.toString();
}

/**
 * Reduce one API result to a photo, or `null` if it should not be shown.
 *
 * Three things are required: an https thumbnail on the upload host, a licence
 * short name, and a Commons description page. "Freely licensed" is a claim the
 * grid has to be able to show evidence for, so a missing licence is a reason to
 * drop the file, not to guess at one.
 */
export function toPhoto(page: unknown): CommonsPhoto | null {
  if (typeof page !== 'object' || page === null) return null;
  const record = page as Record<string, unknown>;
  if (typeof record['title'] !== 'string') return null;
  if (!Array.isArray(record['imageinfo'])) return null;

  const info = record['imageinfo'][0] as Record<string, unknown> | undefined;
  if (!info) return null;

  const thumbnail = safeUrl(info['thumburl'], [THUMBNAIL_HOST]);
  if (!thumbnail) return null;

  const meta = (info['extmetadata'] ?? {}) as Record<string, Record<string, unknown>>;
  const licence = plainText(meta['LicenseShortName']?.['value']);
  if (!isFreeLicence(licence)) return null;

  const title = record['title'];
  // Built here rather than read from the response. `encodeURI` leaves the colon
  // in `File:` alone, which is what Commons expects, and escapes the rest.
  const pageUrl = `https://${PAGE_HOST}/wiki/${encodeURI(title.replace(/ /g, '_'))}`;

  return {
    title,
    thumbnail,
    // The full-size URL is behind a link, so it goes through the same check.
    fileUrl: safeUrl(info['url'], [THUMBNAIL_HOST]) ?? thumbnail,
    pageUrl,
    licence,
    licenceUrl:
      safeUrl(meta['LicenseUrl']?.['value'], ['creativecommons.org', 'www.gnu.org']) ?? '',
    author: plainText(meta['Artist']?.['value']),
    description: plainText(meta['ImageDescription']?.['value']),
  };
}

/**
 * Commons metadata is HTML written by volunteers, so it is parsed and reduced to
 * text rather than trusted. `DOMParser` does not run scripts and does not fetch
 * anything referenced inside.
 */
export function plainText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (!/<[a-z!/]/i.test(value)) return value.trim();

  const doc = new DOMParser().parseFromString(value, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Keep the first `limit` photos, dropping anything unusable. */
export function parseResults(payload: unknown, limit = RESULT_LIMIT): CommonsPhoto[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const query = (payload as Record<string, unknown>)['query'];
  if (typeof query !== 'object' || query === null) return [];

  const pages = (query as Record<string, unknown>)['pages'];
  if (!Array.isArray(pages)) return [];

  const photos: CommonsPhoto[] = [];
  for (const page of pages) {
    const photo = toPhoto(page);
    if (photo) photos.push(photo);
    if (photos.length === limit) break;
  }
  return photos;
}

/** Turn an API or network problem into a sentence a visitor can act on. */
export function searchErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Photo lookup was replaced by a new expression.';
  }
  const text = error instanceof Error ? error.message : String(error);
  if (/429/.test(text)) {
    return 'Wikimedia asked us to slow down. Photos will come back in a moment.';
  }
  return 'Photos could not be loaded from Wikimedia Commons.';
}

/**
 * Ask Commons for photos of one phrase. Throws on failure; callers turn that
 * into a message with `searchErrorMessage`.
 */
export async function searchCommons(
  term: string,
  options: CommonsSearchOptions = {},
): Promise<CommonsPhoto[]> {
  const request = options.fetchImpl ?? fetch;
  const response = await request(searchUrl(term), {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Wikimedia Commons returned ${response.status}.`);
  }
  return parseResults(await response.json());
}
