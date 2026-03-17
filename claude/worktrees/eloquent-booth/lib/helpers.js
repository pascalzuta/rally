/**
 * Extracted pure functions from the source files (news.js, cms.js, app.js)
 * for unit testing purposes.
 *
 * The source files use IIFEs and do not export anything, so these functions
 * are re-implemented here to allow testing in isolation.
 *
 * TODO: Refactor the source files to use ES modules so that functions can be
 * imported directly instead of being duplicated here. When that refactor
 * happens, this helper file should be removed and tests should import
 * from the source modules.
 */

// ---------------------------------------------------------------------------
// From news.js
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters in a string to prevent XSS.
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Splits a text value into paragraphs by splitting on double newlines,
 * trimming each paragraph, and removing empty entries.
 */
export function parseParagraphs(value) {
  return String(value)
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Formats an ISO date string (e.g. "2025-12-22") into a locale-friendly
 * long date. Returns the original string if the date is invalid.
 */
export function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Sorts an array of post objects by publishedAt descending (newest first).
 * Returns a new sorted array.
 */
export function sortPostsNewestFirst(posts) {
  return [...posts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/**
 * Checks whether a slug is unique among existing posts.
 * Returns true if the slug is unique (not found), false if it already exists.
 * When editing an existing post, pass its id as `excludeId` so it does not
 * conflict with itself.
 */
export function isSlugUnique(slug, existingPosts, seedPosts, excludeId) {
  const duplicateInCustom = existingPosts.some(
    (item) => item.slug === slug && item.id !== excludeId
  );
  const duplicateInSeed = seedPosts.some((item) => item.slug === slug);
  return !duplicateInCustom && !duplicateInSeed;
}

/**
 * Filters posts to only those with status === "published".
 */
export function filterPublished(posts) {
  return posts.filter((post) => post.status === 'published');
}

// ---------------------------------------------------------------------------
// From cms.js
// ---------------------------------------------------------------------------

const CMS_STORAGE_KEY = 'grp-cms-areas-v4';
const LEGACY_STORAGE_KEYS = [
  'grp-cms-areas-v3',
  'grp-cms-areas-v2',
  'grp-cms-overrides-v1',
];

/**
 * Reads the CMS store from localStorage. Returns an empty object if nothing
 * is stored or if the stored value is not a valid JSON object.
 */
export function getStore() {
  try {
    const raw = localStorage.getItem(CMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Writes the CMS store object to localStorage.
 */
export function setStore(store) {
  localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(store));
}

/**
 * Migrates legacy CMS data to the current storage key if the current key
 * does not already exist. Only migrates text-based fields; image-like fields
 * are intentionally skipped.
 */
export function migrateLegacyIfNeeded(cmsConfig) {
  if (localStorage.getItem(CMS_STORAGE_KEY)) return;

  const IMAGE_TYPES = new Set([
    'image',
    'image-multi',
    'css-image',
    'iframe-src',
  ]);

  let legacy = null;
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        legacy = parsed;
        break;
      }
    } catch {
      // Ignore malformed legacy payload.
    }
  }
  if (!legacy) return;

  const migrated = {};
  Object.keys(cmsConfig).forEach((page) => {
    const areas = cmsConfig[page] || [];
    const source = legacy[page];
    if (!source || typeof source !== 'object') return;
    const target = {};
    areas.forEach((area) => {
      if (IMAGE_TYPES.has(area.type)) return;
      if (typeof source[area.key] === 'string')
        target[area.key] = source[area.key];
    });
    if (Object.keys(target).length) migrated[page] = target;
  });
  localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(migrated));
}

/**
 * Normalizes a pathname to a page key the same way cms.js does.
 * E.g. "/foo/bar/index.html" -> "index.html", "/about/" -> "index.html"
 */
export function pageKey(pathname) {
  const path = pathname || '/index.html';
  const normalized = path.endsWith('/') ? `${path}index.html` : path;
  return normalized.split('/').pop() || 'index.html';
}

// ---------------------------------------------------------------------------
// From cms.js - additional helpers
// ---------------------------------------------------------------------------

/**
 * List of all CMS config page keys.
 */
export const CMS_CONFIG_PAGES = [
  'index.html', 'structure.html', 'investment-approach.html',
  'team.html', 'contact.html', 'news.html', 'post.html',
];

/**
 * Set of image-like CMS field types.
 */
export const IMAGE_TYPES = new Set(['image', 'image-multi', 'css-image', 'iframe-src']);

/**
 * Checks whether a CMS field type is an image-like type.
 */
export function isImageType(type) {
  return IMAGE_TYPES.has(type);
}

/**
 * Validates that a URL uses a safe protocol (cms.js version).
 * Accepts https://, http://, relative paths starting with ./ or /.
 */
export function isSafeUrl(url) {
  const trimmed = String(url).trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('/')
  );
}

// ---------------------------------------------------------------------------
// From app.js
// ---------------------------------------------------------------------------

/**
 * Checks if the user has been granted site access via the gate.
 */
export function hasSiteAccess() {
  return localStorage.getItem('grp-site-gate-auth-v1') === 'true';
}

/**
 * Grants site access by setting the gate flag in localStorage.
 */
export function grantSiteAccess() {
  localStorage.setItem('grp-site-gate-auth-v1', 'true');
}

/**
 * Checks if the owner is authenticated.
 */
export function isOwnerAuthenticated() {
  return localStorage.getItem('grp-owner-auth-v1') === 'true';
}

/**
 * Sets the owner authentication state.
 */
export function setOwnerAuthenticated(value) {
  localStorage.setItem('grp-owner-auth-v1', value ? 'true' : 'false');
}

/**
 * Determines which nav links should be active based on the current pathname.
 * Returns an array of booleans corresponding to each link href.
 */
export function getNavActiveLink(pathname, links) {
  const navPath = (pathname.split('/').pop() || 'index.html').toLowerCase();
  return links.map((href) => {
    const hrefPath = (href || '').replace('./', '').toLowerCase();
    const isHomeMatch = (navPath === '' || navPath === 'index.html') && (hrefPath === '' || hrefPath === 'index.html');
    const isDirectMatch = hrefPath !== '' && hrefPath === navPath;
    return isHomeMatch || isDirectMatch;
  });
}

/**
 * Builds a mailto URL from contact form fields.
 */
export function buildMailtoUrl(fields) {
  const lines = [
    `Name: ${fields.firstName} ${fields.lastName}`.trim(),
    `Email: ${fields.email}`,
    `Phone: ${fields.phone || 'Not provided'}`,
    `Company: ${fields.company || 'Not provided'}`,
    `Inquiry Type: ${fields.inquiryType}`,
    '',
    'Message:',
    fields.message,
  ];
  const subject = `Contact Form - ${fields.inquiryType}`;
  const body = lines.join('\n');
  return `mailto:info@greenroompartners.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Determines which element should receive focus during a focus trap cycle.
 * Returns the element to focus, or null if no wrapping is needed.
 */
export function trapFocusGetBounds(focusableElements, activeElement, shiftKey) {
  if (!focusableElements.length) return null;
  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null;
}

// ---------------------------------------------------------------------------
// From news.js - additional helpers
// ---------------------------------------------------------------------------

const NEWS_STORAGE_KEY = 'grp-custom-posts-v1';

/**
 * Retrieves custom posts from localStorage.
 */
export function getCustomPosts() {
  try {
    const raw = localStorage.getItem(NEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists custom posts to localStorage.
 */
export function setCustomPosts(posts) {
  localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(posts));
}

/**
 * Constructs a post URL from slug and page number.
 */
export function postUrl(slug, page) {
  return `./post.html?slug=${encodeURIComponent(slug)}&page=${page}`;
}

/**
 * Combines seed posts and custom posts, sorted newest first.
 */
export function allPosts(seedPosts, customPosts) {
  return [...seedPosts, ...customPosts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/**
 * Returns only published posts from the combined seed + custom set.
 */
export function publishedFromAll(seedPosts, customPosts) {
  return allPosts(seedPosts, customPosts).filter((p) => p.status === 'published');
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a URL string uses a safe protocol.
 * Accepts https://, http://, relative paths starting with ./ or /.
 * Rejects javascript: and other dangerous protocols.
 */
export function isValidUrl(url) {
  const trimmed = String(url).trim();
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed)) return false;
  if (/^vbscript:/i.test(trimmed)) return false;
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('/')
  ) {
    return true;
  }
  return false;
}
