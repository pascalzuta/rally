import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hasSiteAccess,
  grantSiteAccess,
  isOwnerAuthenticated,
  setOwnerAuthenticated,
  getNavActiveLink,
  buildMailtoUrl,
  trapFocusGetBounds,
} from '../lib/helpers.js';

// ---------------------------------------------------------------------------
// Setup: provide a proper localStorage mock.
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
// Site gate password
// ---------------------------------------------------------------------------
describe('hasSiteAccess', () => {
  it('returns false when localStorage is empty', () => {
    expect(hasSiteAccess()).toBe(false);
  });

  it('returns false when value is not "true"', () => {
    localStorage.setItem('grp-site-gate-auth-v1', 'false');
    expect(hasSiteAccess()).toBe(false);
  });

  it('returns true when value is "true"', () => {
    localStorage.setItem('grp-site-gate-auth-v1', 'true');
    expect(hasSiteAccess()).toBe(true);
  });

  it('returns false for arbitrary string values', () => {
    localStorage.setItem('grp-site-gate-auth-v1', 'yes');
    expect(hasSiteAccess()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Site gate localStorage persistence
// ---------------------------------------------------------------------------
describe('grantSiteAccess', () => {
  it('sets the gate flag to "true" in localStorage', () => {
    grantSiteAccess();
    expect(localStorage.getItem('grp-site-gate-auth-v1')).toBe('true');
  });

  it('makes hasSiteAccess return true after granting', () => {
    expect(hasSiteAccess()).toBe(false);
    grantSiteAccess();
    expect(hasSiteAccess()).toBe(true);
  });

  it('overwrites any previous value', () => {
    localStorage.setItem('grp-site-gate-auth-v1', 'false');
    grantSiteAccess();
    expect(hasSiteAccess()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Owner authentication
// ---------------------------------------------------------------------------
describe('isOwnerAuthenticated', () => {
  it('returns false when localStorage is empty', () => {
    expect(isOwnerAuthenticated()).toBe(false);
  });

  it('returns true when value is "true"', () => {
    localStorage.setItem('grp-owner-auth-v1', 'true');
    expect(isOwnerAuthenticated()).toBe(true);
  });

  it('returns false when value is "false"', () => {
    localStorage.setItem('grp-owner-auth-v1', 'false');
    expect(isOwnerAuthenticated()).toBe(false);
  });

  it('returns false for arbitrary values', () => {
    localStorage.setItem('grp-owner-auth-v1', '1');
    expect(isOwnerAuthenticated()).toBe(false);
  });
});

describe('setOwnerAuthenticated', () => {
  it('sets value to "true" when passed true', () => {
    setOwnerAuthenticated(true);
    expect(localStorage.getItem('grp-owner-auth-v1')).toBe('true');
  });

  it('sets value to "false" when passed false', () => {
    setOwnerAuthenticated(false);
    expect(localStorage.getItem('grp-owner-auth-v1')).toBe('false');
  });

  it('roundtrips correctly with isOwnerAuthenticated', () => {
    setOwnerAuthenticated(true);
    expect(isOwnerAuthenticated()).toBe(true);
    setOwnerAuthenticated(false);
    expect(isOwnerAuthenticated()).toBe(false);
  });

  it('treats falsy values as false', () => {
    setOwnerAuthenticated(0);
    expect(isOwnerAuthenticated()).toBe(false);
  });

  it('treats truthy values as true', () => {
    setOwnerAuthenticated(1);
    expect(isOwnerAuthenticated()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Nav active state
// ---------------------------------------------------------------------------
describe('getNavActiveLink', () => {
  const links = [
    './index.html',
    './structure.html',
    './investment-approach.html',
    './team.html',
    './news.html',
    './contact.html',
  ];

  it('marks index.html as active for root path', () => {
    const result = getNavActiveLink('/index.html', links);
    expect(result[0]).toBe(true);
    expect(result[1]).toBe(false);
  });

  it('marks index.html as active for empty filename', () => {
    const result = getNavActiveLink('/', links);
    expect(result[0]).toBe(true);
  });

  it('marks structure.html as active', () => {
    const result = getNavActiveLink('/structure.html', links);
    expect(result[1]).toBe(true);
    expect(result[0]).toBe(false);
  });

  it('marks investment-approach.html as active', () => {
    const result = getNavActiveLink('/investment-approach.html', links);
    expect(result[2]).toBe(true);
  });

  it('marks team.html as active', () => {
    const result = getNavActiveLink('/team.html', links);
    expect(result[3]).toBe(true);
  });

  it('marks news.html as active', () => {
    const result = getNavActiveLink('/news.html', links);
    expect(result[4]).toBe(true);
  });

  it('marks contact.html as active', () => {
    const result = getNavActiveLink('/contact.html', links);
    expect(result[5]).toBe(true);
  });

  it('handles nested paths', () => {
    const result = getNavActiveLink('/some/deep/path/team.html', links);
    expect(result[3]).toBe(true);
  });

  it('is case insensitive', () => {
    const result = getNavActiveLink('/TEAM.HTML', links);
    expect(result[3]).toBe(true);
  });

  it('returns all false for an unknown page', () => {
    const result = getNavActiveLink('/unknown.html', links);
    expect(result.every((v) => v === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Contact form - mailto URL construction
// ---------------------------------------------------------------------------
describe('buildMailtoUrl', () => {
  it('builds a valid mailto URL with all fields', () => {
    const fields = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-1234',
      company: 'Acme Corp',
      inquiryType: 'General Inquiry',
      message: 'Hello, world!',
    };
    const url = buildMailtoUrl(fields);
    expect(url).toContain('mailto:info@greenroompartners.com');
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
    expect(url).toContain(encodeURIComponent('Contact Form - General Inquiry'));
    expect(url).toContain(encodeURIComponent('Name: John Doe'));
    expect(url).toContain(encodeURIComponent('Email: john@example.com'));
    expect(url).toContain(encodeURIComponent('Phone: 555-1234'));
    expect(url).toContain(encodeURIComponent('Company: Acme Corp'));
    expect(url).toContain(encodeURIComponent('Hello, world!'));
  });

  it('uses "Not provided" for empty phone', () => {
    const fields = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '',
      company: '',
      inquiryType: 'Partnership',
      message: 'Interested in partnership.',
    };
    const url = buildMailtoUrl(fields);
    expect(url).toContain(encodeURIComponent('Phone: Not provided'));
    expect(url).toContain(encodeURIComponent('Company: Not provided'));
  });

  it('encodes special characters in subject', () => {
    const fields = {
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '',
      company: '',
      inquiryType: 'Q & A',
      message: 'Test',
    };
    const url = buildMailtoUrl(fields);
    expect(url).toContain(encodeURIComponent('Contact Form - Q & A'));
  });

  it('encodes newlines in message body', () => {
    const fields = {
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '',
      company: '',
      inquiryType: 'General',
      message: 'Line 1\nLine 2',
    };
    const url = buildMailtoUrl(fields);
    expect(url).toContain(encodeURIComponent('Line 1\nLine 2'));
  });

  it('includes inquiry type in both subject and body', () => {
    const fields = {
      firstName: 'X',
      lastName: 'Y',
      email: 'x@y.com',
      phone: '',
      company: '',
      inquiryType: 'Investment',
      message: 'Test',
    };
    const url = buildMailtoUrl(fields);
    expect(url).toContain(encodeURIComponent('Contact Form - Investment'));
    expect(url).toContain(encodeURIComponent('Inquiry Type: Investment'));
  });
});

// ---------------------------------------------------------------------------
// Focus trap
// ---------------------------------------------------------------------------
describe('trapFocusGetBounds', () => {
  it('returns null when there are no focusable elements', () => {
    expect(trapFocusGetBounds([], {}, false)).toBeNull();
  });

  it('returns last element when shift+tab on first element', () => {
    const first = { id: 'first' };
    const last = { id: 'last' };
    const elements = [first, { id: 'mid' }, last];
    expect(trapFocusGetBounds(elements, first, true)).toBe(last);
  });

  it('returns first element when tab on last element', () => {
    const first = { id: 'first' };
    const last = { id: 'last' };
    const elements = [first, { id: 'mid' }, last];
    expect(trapFocusGetBounds(elements, last, false)).toBe(first);
  });

  it('returns null when focus is in the middle (no wrap needed)', () => {
    const first = { id: 'first' };
    const mid = { id: 'mid' };
    const last = { id: 'last' };
    const elements = [first, mid, last];
    expect(trapFocusGetBounds(elements, mid, false)).toBeNull();
    expect(trapFocusGetBounds(elements, mid, true)).toBeNull();
  });

  it('handles single element - wraps to itself on tab', () => {
    const only = { id: 'only' };
    const elements = [only];
    expect(trapFocusGetBounds(elements, only, false)).toBe(only);
    expect(trapFocusGetBounds(elements, only, true)).toBe(only);
  });

  it('handles two elements correctly', () => {
    const first = { id: 'first' };
    const last = { id: 'last' };
    const elements = [first, last];
    expect(trapFocusGetBounds(elements, last, false)).toBe(first);
    expect(trapFocusGetBounds(elements, first, true)).toBe(last);
  });
});

// ---------------------------------------------------------------------------
// Site gate password validation logic
// ---------------------------------------------------------------------------
describe('site gate password validation', () => {
  const SITE_PASSWORD = 'forbidden';

  it('accepts the correct password "forbidden"', () => {
    const input = 'forbidden';
    expect(input === SITE_PASSWORD).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const input = 'wrong';
    expect(input === SITE_PASSWORD).toBe(false);
  });

  it('is case-sensitive', () => {
    expect('Forbidden' === SITE_PASSWORD).toBe(false);
    expect('FORBIDDEN' === SITE_PASSWORD).toBe(false);
  });

  it('rejects empty string', () => {
    expect('' === SITE_PASSWORD).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Owner login credential validation
// ---------------------------------------------------------------------------
describe('owner login credential validation', () => {
  const OWNER_USERNAME = 'christian';
  const OWNER_PASSWORD = 'Schmuck';

  function validateCredentials(username, password) {
    const u = String(username).trim().toLowerCase();
    const p = String(password).trim();
    return (u === OWNER_USERNAME || u === 'login christian') && p === OWNER_PASSWORD;
  }

  it('accepts valid credentials (christian / Schmuck)', () => {
    expect(validateCredentials('christian', 'Schmuck')).toBe(true);
  });

  it('accepts alternative username "login christian"', () => {
    expect(validateCredentials('login christian', 'Schmuck')).toBe(true);
  });

  it('is case insensitive for username', () => {
    expect(validateCredentials('Christian', 'Schmuck')).toBe(true);
    expect(validateCredentials('CHRISTIAN', 'Schmuck')).toBe(true);
  });

  it('is case sensitive for password', () => {
    expect(validateCredentials('christian', 'schmuck')).toBe(false);
    expect(validateCredentials('christian', 'SCHMUCK')).toBe(false);
  });

  it('rejects wrong username', () => {
    expect(validateCredentials('admin', 'Schmuck')).toBe(false);
  });

  it('rejects wrong password', () => {
    expect(validateCredentials('christian', 'wrong')).toBe(false);
  });

  it('rejects empty credentials', () => {
    expect(validateCredentials('', '')).toBe(false);
  });

  it('trims whitespace from inputs', () => {
    expect(validateCredentials('  christian  ', '  Schmuck  ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Footer year display
// ---------------------------------------------------------------------------
describe('footer year', () => {
  it('generates current year as a string', () => {
    const year = String(new Date().getFullYear());
    expect(year).toMatch(/^\d{4}$/);
    expect(Number(year)).toBeGreaterThanOrEqual(2025);
  });
});
