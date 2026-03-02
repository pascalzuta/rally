import { describe, it, expect } from 'vitest';
import { escapeHtml, isValidUrl } from '../lib/helpers.js';

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes < to &lt;', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });

  it('escapes > to &gt;', () => {
    expect(escapeHtml('>')).toBe('&gt;');
  });

  it('escapes & to &amp;', () => {
    expect(escapeHtml('&')).toBe('&amp;');
  });

  it('escapes double quotes to &quot;', () => {
    expect(escapeHtml('"')).toBe('&quot;');
  });

  it('escapes single quotes to &#39;', () => {
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('escapes all special characters in a mixed string', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('returns the same string when there is nothing to escape', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('handles an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('coerces non-string input to string', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('escapes & before other entities to prevent double-escaping issues', () => {
    // & is replaced first in the function, so &lt; in input becomes &amp;lt;
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

// ---------------------------------------------------------------------------
// URL validation: reject dangerous protocols
// ---------------------------------------------------------------------------
describe('isValidUrl - rejection of dangerous protocols', () => {
  it('rejects javascript: URLs', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects JavaScript: with mixed case', () => {
    expect(isValidUrl('JavaScript:alert(1)')).toBe(false);
  });

  it('rejects JAVASCRIPT: in uppercase', () => {
    expect(isValidUrl('JAVASCRIPT:void(0)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isValidUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects vbscript: URLs', () => {
    expect(isValidUrl('vbscript:msgbox("hi")')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// URL validation: accept safe protocols and relative paths
// ---------------------------------------------------------------------------
describe('isValidUrl - acceptance of safe URLs', () => {
  it('accepts https:// URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('accepts http:// URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts relative paths starting with ./', () => {
    expect(isValidUrl('./page.html')).toBe(true);
  });

  it('accepts absolute paths starting with /', () => {
    expect(isValidUrl('/about.html')).toBe(true);
  });

  it('rejects bare strings that are not valid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('trims whitespace before checking', () => {
    expect(isValidUrl('  https://example.com  ')).toBe(true);
  });
});
