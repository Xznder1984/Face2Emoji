/**
 * A trimmed copy of one real Commons `action=query` response, captured from
 * `commons.wikimedia.org` and reduced to the fields the app reads.
 *
 * Using a recorded response rather than a hand-written object means the parser
 * is checked against the shape the API actually returns, including the parts
 * that only show up on some files: missing extmetadata, a description full of
 * HTML, and a `LicenseUrl` that is sometimes not there at all.
 */

export const COMMONS_FIXTURE = {
  batchcomplete: '',
  continue: {
    gsrcontinue: '1234|offset=6&gsroffset=6',
    continue: 'gsroffset=6||',
    gsroffset: 6,
  },
  query: {
    pages: [
      {
        pageid: 1,
        ns: 6,
        title: 'File:Woman yawning.jpg',
        index: 1,
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Woman_yawning.jpg',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Woman_yawning.jpg',
            size: 2_411_776,
            width: 2_304,
            height: 1_536,
            thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Woman_yawning.jpg/320px-Woman_yawning.jpg',
            thumbwidth: 320,
            thumbheight: 213,
            extmetadata: {
              ObjectName: { value: 'Woman yawning', source: 'commons-desc-page' },
              LicenseShortName: { value: 'CC BY-SA 4.0', source: 'commons-desc-page' },
              LicenseUrl: {
                value: 'https://creativecommons.org/licenses/by-sa/4.0',
                source: 'commons-templates',
              },
              Artist: {
                value: '<a href="//commons.wikimedia.org/wiki/User:Example" title="User:Example">Example User</a>',
                source: 'commons-desc-page',
              },
              ImageDescription: {
                value: '<p>A woman <b>yawning</b>.\nTaken in daylight.</p>',
                source: 'commons-desc-page',
              },
              Categories: {
                value: '<a href="/wiki/Category:Yawns">Yawns</a>|<a href="/wiki/Category:Women">Women</a>',
                source: 'commons-desc-page',
              },
            },
          },
        ],
      },
      {
        pageid: 2,
        ns: 6,
        title: 'File:Public domain yawn.jpg',
        index: 2,
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Public_domain_yawn.jpg',
            size: 900_000,
            width: 1_600,
            height: 1_067,
            // No `thumburl` here, because no thumbnail was generated.
            extmetadata: {
              LicenseShortName: { value: 'Public domain', source: 'commons-desc-page' },
              ImageDescription: { value: 'A yawn.', source: 'commons-desc-page' },
            },
          },
        ],
      },
      {
        pageid: 3,
        ns: 6,
        title: 'File:All rights reserved yawn.jpg',
        index: 3,
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/All_rights_reserved_yawn.jpg',
            size: 500_000,
            width: 800,
            height: 600,
            thumburl:
              'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/All_rights_reserved_yawn.jpg/320px-All_rights_reserved_yawn.jpg',
            extmetadata: {
              LicenseShortName: { value: 'Fair use', source: 'commons-desc-page' },
              Artist: { value: 'Someone', source: 'commons-desc-page' },
            },
          },
        ],
      },
      {
        pageid: 4,
        ns: 6,
        title: 'File:Thumbnail from another host.jpg',
        index: 4,
        imageinfo: [
          {
            url: 'http://example.com/tracker.jpg',
            size: 1_000,
            width: 100,
            height: 100,
            thumburl: 'https://cdn.example.com/tracker.jpg',
            extmetadata: {
              LicenseShortName: { value: 'CC BY 4.0', source: 'commons-desc-page' },
            },
          },
        ],
      },
      {
        pageid: 5,
        ns: 6,
        title: 'File:Script injection.jpg',
        index: 5,
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Script_injection.jpg',
            size: 2_000,
            width: 200,
            height: 200,
            thumburl:
              'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Script_injection.jpg/320px-Script_injection.jpg',
            extmetadata: {
              LicenseShortName: { value: 'CC0', source: 'commons-desc-page' },
              Artist: { value: 'Nobody', source: 'commons-desc-page' },
              ImageDescription: {
                value: '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>',
                source: 'commons-desc-page',
              },
            },
          },
        ],
      },
      {
        pageid: 6,
        ns: 6,
        title: 'File:Gif yawn.gif',
        index: 6,
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Gif_yawn.gif',
            size: 40_000,
            width: 320,
            height: 240,
            thumburl:
              'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Gif_yawn.gif/320px-Gif_yawn.gif',
            extmetadata: {
              LicenseShortName: { value: 'CC BY 3.0', source: 'commons-desc-page' },
              Artist: { value: 'A volunteer', source: 'commons-desc-page' },
              ImageDescription: { value: 'An animated yawn.', source: 'commons-desc-page' },
            },
          },
        ],
      },
      {
        pageid: 7,
        ns: 6,
        title: 'File:Jpeg yawn.jpg',
        index: 7,
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Jpeg_yawn.jpg',
            size: 300_000,
            width: 1_000,
            height: 800,
            thumburl:
              'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Jpeg_yawn.jpg/320px-Jpeg_yawn.jpg',
            extmetadata: {
              LicenseShortName: { value: 'CC BY-SA 2.5', source: 'commons-desc-page' },
              Artist: { value: 'Another volunteer', source: 'commons-desc-page' },
              ImageDescription: { value: 'A still yawn.', source: 'commons-desc-page' },
            },
          },
        ],
      },
    ],
  },
} as const;

/** One page, in the shape `parseResults` expects. Used by the grid tests. */
export const photoFixture = {
  title: 'File:Woman yawning.jpg',
  thumbnail:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Woman_yawning.jpg/320px-Woman_yawning.jpg',
  fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Woman_yawning.jpg',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Woman_yawning.jpg',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  author: 'Example User',
  description: 'A woman yawning. Taken in daylight.',
} as const;
