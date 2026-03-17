import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStore,
  setStore,
  migrateLegacyIfNeeded,
  pageKey,
  CMS_CONFIG_PAGES,
  IMAGE_TYPES,
  isImageType,
  isSafeUrl,
} from '../lib/helpers.js';

// ---------------------------------------------------------------------------
// Setup: provide a proper localStorage mock.
// Node 25 exposes a native localStorage that lacks standard Web Storage API
// methods (clear, removeItem, etc.). We replace it with a full in-memory
// implementation so the CMS store helpers work correctly in tests.
// ---------------------------------------------------------------------------
function createLocalStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key(index) {
      return Object.keys(store)[index] ?? null;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
});

// ---------------------------------------------------------------------------
// getStore
// ---------------------------------------------------------------------------
describe('getStore', () => {
  it('returns an empty object when localStorage is empty', () => {
    expect(getStore()).toEqual({});
  });

  it('returns an empty object when the stored value is not valid JSON', () => {
    localStorage.setItem('grp-cms-areas-v4', 'not json');
    expect(getStore()).toEqual({});
  });

  it('returns the parsed value when the stored value is a JSON array', () => {
    // Note: typeof [] === "object" in JavaScript, so the source code's
    // check (parsed && typeof parsed === "object") allows arrays through.
    // This matches the actual behavior in cms.js.
    localStorage.setItem('grp-cms-areas-v4', '[1,2,3]');
    expect(getStore()).toEqual([1, 2, 3]);
  });

  it('returns the parsed object when valid JSON object is stored', () => {
    const data = { 'index.html': { hero: 'Hello' } };
    localStorage.setItem('grp-cms-areas-v4', JSON.stringify(data));
    expect(getStore()).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// setStore / getStore roundtrip
// ---------------------------------------------------------------------------
describe('setStore / getStore roundtrip', () => {
  it('stores and retrieves data correctly', () => {
    const data = {
      'index.html': { hero_main: 'Welcome\n\nTo our site' },
      'contact.html': { hero: 'Contact Us\n\nReach out' },
    };
    setStore(data);
    expect(getStore()).toEqual(data);
  });

  it('overwrites previous data on subsequent setStore calls', () => {
    setStore({ page: { key: 'old' } });
    setStore({ page: { key: 'new' } });
    expect(getStore()).toEqual({ page: { key: 'new' } });
  });

  it('handles empty object roundtrip', () => {
    setStore({});
    expect(getStore()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// migrateLegacyIfNeeded
// ---------------------------------------------------------------------------
describe('migrateLegacyIfNeeded', () => {
  const cmsConfig = {
    'index.html': [
      { key: 'hero_main', label: 'Hero Main', type: 'pair' },
      {
        key: 'hero_image',
        label: 'Hero Image',
        type: 'image',
        defaultValue: 'img.jpg',
      },
    ],
    'contact.html': [
      { key: 'hero', label: 'Hero', type: 'pair' },
    ],
  };

  it('skips migration when current storage key already exists', () => {
    localStorage.setItem('grp-cms-areas-v4', JSON.stringify({ existing: true }));
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': { hero_main: 'Legacy' } })
    );

    migrateLegacyIfNeeded(cmsConfig);

    // The current key should remain unchanged
    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store).toEqual({ existing: true });
  });

  it('migrates text fields from the first matching legacy key', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({
        'index.html': { hero_main: 'Legacy Title', hero_image: 'old.jpg' },
      })
    );

    migrateLegacyIfNeeded(cmsConfig);

    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    // Text field should be migrated
    expect(store['index.html'].hero_main).toBe('Legacy Title');
    // Image field should NOT be migrated
    expect(store['index.html'].hero_image).toBeUndefined();
  });

  it('does nothing when no legacy keys exist', () => {
    migrateLegacyIfNeeded(cmsConfig);
    expect(localStorage.getItem('grp-cms-areas-v4')).toBeNull();
  });

  it('skips legacy keys with malformed JSON', () => {
    localStorage.setItem('grp-cms-areas-v3', 'broken{json');
    localStorage.setItem(
      'grp-cms-areas-v2',
      JSON.stringify({
        'contact.html': { hero: 'Fallback' },
      })
    );

    migrateLegacyIfNeeded(cmsConfig);

    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store['contact.html'].hero).toBe('Fallback');
  });

  it('tries legacy keys in order and stops at the first valid one', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': { hero_main: 'From v3' } })
    );
    localStorage.setItem(
      'grp-cms-areas-v2',
      JSON.stringify({ 'index.html': { hero_main: 'From v2' } })
    );

    migrateLegacyIfNeeded(cmsConfig);

    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store['index.html'].hero_main).toBe('From v3');
  });
});

// ---------------------------------------------------------------------------
// pageKey normalization
// ---------------------------------------------------------------------------
describe('pageKey', () => {
  it('extracts the filename from a full path', () => {
    expect(pageKey('/foo/bar/about.html')).toBe('about.html');
  });

  it('defaults to index.html for a trailing slash', () => {
    expect(pageKey('/foo/bar/')).toBe('index.html');
  });

  it('defaults to index.html for root path /', () => {
    expect(pageKey('/')).toBe('index.html');
  });

  it('defaults to index.html when pathname is empty/undefined', () => {
    expect(pageKey('')).toBe('index.html');
    expect(pageKey(undefined)).toBe('index.html');
  });

  it('handles a simple filename without directories', () => {
    expect(pageKey('/contact.html')).toBe('contact.html');
  });

  it('handles a path like /index.html', () => {
    expect(pageKey('/index.html')).toBe('index.html');
  });
});

// ---------------------------------------------------------------------------
// CMS_CONFIG_PAGES structure
// ---------------------------------------------------------------------------
describe('CMS_CONFIG_PAGES', () => {
  it('contains exactly 7 pages', () => {
    expect(CMS_CONFIG_PAGES).toHaveLength(7);
  });

  it('includes index.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('index.html');
  });

  it('includes structure.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('structure.html');
  });

  it('includes investment-approach.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('investment-approach.html');
  });

  it('includes team.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('team.html');
  });

  it('includes contact.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('contact.html');
  });

  it('includes news.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('news.html');
  });

  it('includes post.html', () => {
    expect(CMS_CONFIG_PAGES).toContain('post.html');
  });
});

// ---------------------------------------------------------------------------
// IMAGE_TYPES set
// ---------------------------------------------------------------------------
describe('IMAGE_TYPES', () => {
  it('contains "image"', () => {
    expect(IMAGE_TYPES.has('image')).toBe(true);
  });

  it('contains "image-multi"', () => {
    expect(IMAGE_TYPES.has('image-multi')).toBe(true);
  });

  it('contains "css-image"', () => {
    expect(IMAGE_TYPES.has('css-image')).toBe(true);
  });

  it('contains "iframe-src"', () => {
    expect(IMAGE_TYPES.has('iframe-src')).toBe(true);
  });

  it('does not contain text types', () => {
    expect(IMAGE_TYPES.has('single')).toBe(false);
    expect(IMAGE_TYPES.has('pair')).toBe(false);
    expect(IMAGE_TYPES.has('triple')).toBe(false);
    expect(IMAGE_TYPES.has('list')).toBe(false);
  });

  it('has exactly 4 members', () => {
    expect(IMAGE_TYPES.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// isImageType
// ---------------------------------------------------------------------------
describe('isImageType', () => {
  it('returns true for image', () => {
    expect(isImageType('image')).toBe(true);
  });

  it('returns true for image-multi', () => {
    expect(isImageType('image-multi')).toBe(true);
  });

  it('returns true for css-image', () => {
    expect(isImageType('css-image')).toBe(true);
  });

  it('returns true for iframe-src', () => {
    expect(isImageType('iframe-src')).toBe(true);
  });

  it('returns false for single', () => {
    expect(isImageType('single')).toBe(false);
  });

  it('returns false for pair', () => {
    expect(isImageType('pair')).toBe(false);
  });

  it('returns false for triple', () => {
    expect(isImageType('triple')).toBe(false);
  });

  it('returns false for list', () => {
    expect(isImageType('list')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isImageType('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl (cms.js version)
// ---------------------------------------------------------------------------
describe('isSafeUrl', () => {
  it('accepts https:// URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('accepts http:// URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('accepts relative paths starting with ./', () => {
    expect(isSafeUrl('./page.html')).toBe(true);
  });

  it('accepts absolute paths starting with /', () => {
    expect(isSafeUrl('/about.html')).toBe(true);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects vbscript: URLs', () => {
    expect(isSafeUrl('vbscript:msgbox("hi")')).toBe(false);
  });

  it('rejects bare strings', () => {
    expect(isSafeUrl('not-a-url')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isSafeUrl('  https://example.com  ')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EXCLUDED set behavior
// ---------------------------------------------------------------------------
describe('EXCLUDED set behavior', () => {
  it('empty set has method and returns false for any page', () => {
    const excluded = new Set();
    expect(excluded.has('index.html')).toBe(false);
    expect(excluded.has('news.html')).toBe(false);
  });

  it('can add and check pages', () => {
    const excluded = new Set(['post.html']);
    expect(excluded.has('post.html')).toBe(true);
    expect(excluded.has('index.html')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Additional getStore edge cases
// ---------------------------------------------------------------------------
describe('getStore - additional edge cases', () => {
  it('returns empty object for null stored value', () => {
    localStorage.setItem('grp-cms-areas-v4', 'null');
    expect(getStore()).toEqual({});
  });

  it('returns empty object for numeric stored value', () => {
    localStorage.setItem('grp-cms-areas-v4', '42');
    expect(getStore()).toEqual({});
  });

  it('returns empty object for boolean string stored value', () => {
    localStorage.setItem('grp-cms-areas-v4', 'true');
    expect(getStore()).toEqual({});
  });

  it('handles deeply nested data', () => {
    const data = { 'index.html': { hero: { nested: { deep: 'value' } } } };
    localStorage.setItem('grp-cms-areas-v4', JSON.stringify(data));
    expect(getStore()).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// migrateLegacyIfNeeded - additional edge cases
// ---------------------------------------------------------------------------
describe('migrateLegacyIfNeeded - additional edge cases', () => {
  const cmsConfig = {
    'index.html': [
      { key: 'hero_main', label: 'Hero Main', type: 'pair' },
      { key: 'hero_image', label: 'Hero Image', type: 'css-image' },
      { key: 'map_embed', label: 'Map', type: 'iframe-src' },
      { key: 'all_photos', label: 'Photos', type: 'image-multi' },
    ],
  };

  it('skips css-image fields during migration', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': { hero_main: 'Text', hero_image: 'img.jpg' } })
    );
    migrateLegacyIfNeeded(cmsConfig);
    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store['index.html'].hero_main).toBe('Text');
    expect(store['index.html'].hero_image).toBeUndefined();
  });

  it('skips iframe-src fields during migration', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': { map_embed: 'https://maps.com', hero_main: 'Hello' } })
    );
    migrateLegacyIfNeeded(cmsConfig);
    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store['index.html'].map_embed).toBeUndefined();
    expect(store['index.html'].hero_main).toBe('Hello');
  });

  it('skips image-multi fields during migration', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': { all_photos: 'photo.jpg', hero_main: 'Hey' } })
    );
    migrateLegacyIfNeeded(cmsConfig);
    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store['index.html'].all_photos).toBeUndefined();
    expect(store['index.html'].hero_main).toBe('Hey');
  });

  it('skips pages not in config', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'unknown.html': { foo: 'bar' } })
    );
    migrateLegacyIfNeeded(cmsConfig);
    const store = JSON.parse(localStorage.getItem('grp-cms-areas-v4'));
    expect(store['unknown.html']).toBeUndefined();
  });

  it('skips non-string legacy values', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': { hero_main: 123 } })
    );
    migrateLegacyIfNeeded(cmsConfig);
    const raw = localStorage.getItem('grp-cms-areas-v4');
    // No text fields to migrate, so either null or empty
    expect(raw === null || JSON.parse(raw)['index.html'] === undefined).toBe(true);
  });

  it('skips pages with non-object source data', () => {
    localStorage.setItem(
      'grp-cms-areas-v3',
      JSON.stringify({ 'index.html': 'not-an-object' })
    );
    migrateLegacyIfNeeded(cmsConfig);
    const raw = localStorage.getItem('grp-cms-areas-v4');
    expect(raw === null || JSON.parse(raw)['index.html'] === undefined).toBe(true);
  });
});
