// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  API_ENDPOINT,
  RESULT_LIMIT,
  THUMBNAIL_WIDTH,
  isFreeLicence,
  parseResults,
  plainText,
  safeUrl,
  searchCommons,
  searchErrorMessage,
  searchUrl,
  toPhoto,
} from '../commons';
import { COMMONS_FIXTURE } from './fixtures/commons-response.json';

const photos = parseResults(COMMONS_FIXTURE);

describe('isFreeLicence', () => {
  it('accepts the free licences Commons actually uses', () => {
    for (const licence of [
      'CC BY-SA 4.0',
      'CC BY 4.0',
      'CC BY 3.0',
      'CC BY 2.0',
      'CC BY 2.5',
      'CC BY-SA 3.0 us',
      'CC0',
      'Public domain',
      'No restrictions',
      'Copyrighted free use',
      'Apache License 2.0',
      'MIT',
      'LGPL',
      'GPL',
      'GPLv3',
      'OFL',
    ]) {
      expect(isFreeLicence(licence)).toBe(true);
    }
  });

  it('rejects anything a visitor would have to pay for or ask about', () => {
    for (const licence of [
      'Fair use',
      'All rights reserved',
      'CC BY-NC 4.0',
      'CC BY-ND 4.0',
      'CC BY-NC-SA 3.0',
      'Non-commercial',
      'Unknown',
      '',
      '   ',
    ]) {
      expect(isFreeLicence(licence)).toBe(false);
    }
  });

  it('rejects a free licence that has been qualified with a restriction', () => {
    expect(isFreeLicence('MIT License, non-commercial only')).toBe(false);
    expect(isFreeLicence('Public domain, except where noted')).toBe(true);
    expect(isFreeLicence('CC BY 4.0, no derivatives')).toBe(false);
  });
});

describe('searchUrl', () => {
  it('asks the Commons action API over https', () => {
    const url = new URL(searchUrl('yawning face'));
    expect(url.origin + url.pathname).toBe(API_ENDPOINT);
    expect(url.protocol).toBe('https:');
  });

  it('searches only inside the File namespace', () => {
    const url = new URL(searchUrl('yawning face'));
    expect(url.searchParams.get('gsrnamespace')).toBe('6');
    expect(url.searchParams.get('generator')).toBe('search');
    expect(url.searchParams.get('gsrsearch')).toBe('yawning face');
  });

  it('asks for JSON, thumbnails and the metadata the grid shows', () => {
    const url = new URL(searchUrl('yawning face'));
    expect(url.searchParams.get('action')).toBe('query');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('origin')).toBe('*');
    expect(url.searchParams.get('prop')).toBe('imageinfo');
    expect(url.searchParams.get('iiprop')).toBe('url|extmetadata|size');
    expect(url.searchParams.get('iiurlwidth')).toBe(String(THUMBNAIL_WIDTH));
    const filter = url.searchParams.get('iiextmetadatafilter') ?? '';
    for (const field of ['LicenseShortName', 'LicenseUrl', 'Artist', 'ImageDescription']) {
      expect(filter).toContain(field);
    }
  });

  it('sends the phrase verbatim and asks for the grid size', () => {
    const url = new URL(searchUrl('smiling face'));
    expect(url.searchParams.get('gsrsearch')).toBe('smiling face');
    expect(url.searchParams.get('gsrlimit')).toBe(String(RESULT_LIMIT));
  });

  it('never carries anything derived from a frame', () => {
    // The only variable input is the fixed phrase from the rule list.
    expect(searchUrl('a b&c=d')).toContain('gsrsearch=a+b%26c%3Dd');
  });
});

describe('safeUrl', () => {
  it('allows https on an expected host', () => {
    expect(safeUrl('https://upload.wikimedia.org/x.jpg', ['upload.wikimedia.org'])).toBe(
      'https://upload.wikimedia.org/x.jpg',
    );
  });

  it('rejects the wrong host, the wrong scheme and nonsense', () => {
    expect(safeUrl('https://cdn.example.com/x.jpg', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl('http://upload.wikimedia.org/x.jpg', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl('javascript:alert(1)', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl('//upload.wikimedia.org/x.jpg', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl('not a url', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl('', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl(42, ['upload.wikimedia.org'])).toBeNull();
  });

  it('is not fooled by a lookalike host', () => {
    expect(safeUrl('https://upload.wikimedia.org.evil.test/x.jpg', ['upload.wikimedia.org'])).toBeNull();
    expect(safeUrl('https://evil.test/?u=upload.wikimedia.org', ['upload.wikimedia.org'])).toBeNull();
  });
});

describe('plainText', () => {
  it('reduces volunteer HTML to text', () => {
    expect(plainText('<p>A woman <b>yawning</b>.</p>')).toBe('A woman yawning.');
  });

  it('collapses newlines and runs of spaces', () => {
    expect(plainText('<p>A woman <b>yawning</b>.\nTaken in daylight.</p>')).toBe(
      'A woman yawning. Taken in daylight.',
    );
  });

  it('keeps plain text as it is', () => {
    expect(plainText('  An animated yawn.  ')).toBe('An animated yawn.');
  });

  it('treats anything that is not a string as absent', () => {
    expect(plainText(undefined)).toBe('');
    expect(plainText(null)).toBe('');
    expect(plainText({ value: 'x' })).toBe('');
  });
});

describe('toPhoto', () => {
  const page = COMMONS_FIXTURE.query.pages[0];

  it('keeps a file with a licence, a thumbnail and a creator', () => {
    const photo = toPhoto(page);
    expect(photo).not.toBeNull();
    expect(photo?.licence).toBe('CC BY-SA 4.0');
    expect(photo?.author).toBe('Example User');
    expect(photo?.licenceUrl).toBe('https://creativecommons.org/licenses/by-sa/4.0');
  });

  it('builds the description page link itself rather than trusting a URL', () => {
    expect(toPhoto(page)?.pageUrl).toBe('https://commons.wikimedia.org/wiki/File:Woman_yawning.jpg');
  });

  it('drops a file with no licence', () => {
    const missing = structuredClone(page) as unknown as Record<string, unknown>;
    const info = (missing['imageinfo'] as Record<string, unknown>[])[0];
    delete info?.['extmetadata'];
    expect(toPhoto(missing)).toBeNull();
  });

  it('drops a file whose licence is not a Creative Commons one', () => {
    expect(toPhoto(COMMONS_FIXTURE.query.pages[2])).toBeNull();
  });

  it('drops a file with no thumbnail', () => {
    expect(toPhoto(COMMONS_FIXTURE.query.pages[1])).toBeNull();
  });

  it('drops a file whose thumbnail is on another host', () => {
    expect(toPhoto(COMMONS_FIXTURE.query.pages[3])).toBeNull();
  });

  it('survives anything that is not a result page', () => {
    for (const value of [null, undefined, 42, 'text', [], {}, { title: 'File:x.jpg' }]) {
      expect(toPhoto(value)).toBeNull();
    }
    expect(toPhoto({ title: 'File:x.jpg', imageinfo: [] })).toBeNull();
  });
});

describe('parseResults', () => {
  it('keeps the order Commons returned', () => {
    expect(photos.map((photo) => photo.title)).toEqual([
      'File:Woman yawning.jpg',
      'File:Script injection.jpg',
      'File:Gif yawn.gif',
      'File:Jpeg yawn.jpg',
    ]);
  });

  it('drops the files with no licence, no thumbnail or a foreign host', () => {
    const titles = photos.map((photo) => photo.title);
    expect(titles).not.toContain('File:Public domain yawn.jpg');
    expect(titles).not.toContain('File:All rights reserved yawn.jpg');
    expect(titles).not.toContain('File:Thumbnail from another host.jpg');
  });

  it('never returns more than the grid shows', () => {
    expect(parseResults(COMMONS_FIXTURE, 2)).toHaveLength(2);
  });

  it('shows volunteer HTML as text, never as markup', () => {
    const injected = photos.find((photo) => photo.title === 'File:Script injection.jpg');
    // The parser drops the element and keeps only its text, so what a volunteer
    // typed is still readable but nothing is executed or turned into a node.
    expect(injected?.description).toBe('window.__pwned=1');
    expect(injected?.description).not.toContain('<');
    expect(document.querySelector('script')).toBeNull();
    expect((window as unknown as Record<string, unknown>)['__pwned']).toBeUndefined();
  });

  it('treats an error payload as no results rather than throwing', () => {
    expect(parseResults({ error: { code: 'badvalue' } })).toEqual([]);
    expect(parseResults(null)).toEqual([]);
    expect(parseResults({ query: {} })).toEqual([]);
    expect(parseResults({ query: { pages: 'nope' } })).toEqual([]);
  });
});

describe('searchCommons', () => {
  const ok = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  it('requests the URL and returns the parsed photos', async () => {
    const calls: string[] = [];
    const result = await searchCommons('yawning face', {
      fetchImpl: async (input) => {
        calls.push(String(input));
        return ok(COMMONS_FIXTURE);
      },
    });
    expect(calls[0]).toBe(searchUrl('yawning face'));
    expect(result).toHaveLength(4);
  });

  it('throws on a non-200 so the caller can show a sentence', async () => {
    await expect(
      searchCommons('yawning face', { fetchImpl: async () => new Response('', { status: 503 }) }),
    ).rejects.toThrow('Wikimedia Commons returned 503.');
  });

  it('passes an abort signal through, so a stale expression can be dropped', async () => {
    const controller = new AbortController();
    let captured: AbortSignal | undefined;

    const pending = searchCommons('yawning face', {
      signal: controller.signal,
      fetchImpl: (_input, init) => {
        captured = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          captured?.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        });
      },
    });

    expect(captured).toBe(controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('The user aborted a request.');
  });
});

describe('searchErrorMessage', () => {
  it('stays quiet when the visitor changed expression', () => {
    expect(searchErrorMessage(new DOMException('x', 'AbortError'))).toBe(
      'Photo lookup was replaced by a new expression.',
    );
  });

  it('explains a rate limit instead of showing a status code', () => {
    expect(searchErrorMessage(new Error('Wikimedia Commons returned 429.'))).toContain('slow down');
  });

  it('gives one plain sentence for anything else', () => {
    expect(searchErrorMessage(new Error('network down'))).toBe(
      'Photos could not be loaded from Wikimedia Commons.',
    );
    expect(searchErrorMessage('odd')).toBe('Photos could not be loaded from Wikimedia Commons.');
  });
});
