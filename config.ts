/**
 * Build-time and runtime constants.
 *
 * There are no API keys, tokens or secrets anywhere in this project, and there
 * is no backend. The only third party at runtime is Wikimedia Commons, and only
 * after the visitor turns photo lookup on.
 */

/** Photo lookup ships off. The visitor has to opt in on every visit. */
export const PHOTOS_DEFAULT_ON = false;

/** Optional contact address. Empty means render no contact block at all. */
export const contactEmail = '';

/** Optional source repository link. Empty means render no repository link. */
export const repoUrl = '';
