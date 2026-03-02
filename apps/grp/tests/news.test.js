import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseParagraphs,
  formatDate,
  sortPostsNewestFirst,
  isSlugUnique,
  filterPublished,
  getCustomPosts,
  setCustomPosts,
  postUrl,
  allPosts,
  publishedFromAll,
} from '../lib/helpers.js';

// ---------------------------------------------------------------------------
// parseParagraphs
// ---------------------------------------------------------------------------
describe('parseParagraphs', () => {
  it('splits text on double newlines', () => {
    const result = parseParagraphs('First paragraph\n\nSecond paragraph');
    expect(result).toEqual(['First paragraph', 'Second paragraph']);
  });

  it('handles double newlines with extra whitespace between them', () => {
    const result = parseParagraphs('A\n  \nB');
    expect(result).toEqual(['A', 'B']);
  });

  it('trims whitespace from each paragraph', () => {
    const result = parseParagraphs('  hello  \n\n  world  ');
    expect(result).toEqual(['hello', 'world']);
  });

  it('filters out empty paragraphs', () => {
    const result = parseParagraphs('\n\n\n\n');
    expect(result).toEqual([]);
  });

  it('returns a single paragraph when there are no double newlines', () => {
    const result = parseParagraphs('one paragraph only');
    expect(result).toEqual(['one paragraph only']);
  });

  it('handles three paragraphs', () => {
    const result = parseParagraphs('A\n\nB\n\nC');
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('coerces non-string input to string', () => {
    const result = parseParagraphs(12345);
    expect(result).toEqual(['12345']);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2025-12-22');
    // The exact format depends on locale, but it should contain the year
    expect(result).toContain('2025');
  });

  it('includes the day number in the formatted output', () => {
    const result = formatDate('2025-01-15');
    expect(result).toContain('15');
  });

  it('returns the original string for an invalid date', () => {
    const result = formatDate('not-a-date');
    expect(result).toBe('not-a-date');
  });

  it('returns the original string for an empty string', () => {
    const result = formatDate('');
    // new Date("T00:00:00") is invalid, so it should return ""
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// sortPostsNewestFirst
// ---------------------------------------------------------------------------
describe('sortPostsNewestFirst', () => {
  it('sorts posts with the newest publishedAt first', () => {
    const posts = [
      { publishedAt: '2025-01-01', title: 'Old' },
      { publishedAt: '2025-06-15', title: 'Mid' },
      { publishedAt: '2025-12-31', title: 'New' },
    ];
    const sorted = sortPostsNewestFirst(posts);
    expect(sorted[0].title).toBe('New');
    expect(sorted[1].title).toBe('Mid');
    expect(sorted[2].title).toBe('Old');
  });

  it('does not mutate the original array', () => {
    const posts = [
      { publishedAt: '2025-01-01', title: 'A' },
      { publishedAt: '2025-12-31', title: 'B' },
    ];
    const sorted = sortPostsNewestFirst(posts);
    expect(sorted).not.toBe(posts);
    expect(posts[0].title).toBe('A');
  });

  it('handles an empty array', () => {
    expect(sortPostsNewestFirst([])).toEqual([]);
  });

  it('handles a single post', () => {
    const posts = [{ publishedAt: '2025-05-01', title: 'Solo' }];
    const sorted = sortPostsNewestFirst(posts);
    expect(sorted).toEqual(posts);
  });
});

// ---------------------------------------------------------------------------
// isSlugUnique (slug uniqueness validation)
// ---------------------------------------------------------------------------
describe('isSlugUnique', () => {
  const seedPosts = [
    { slug: 'seed-post-one', id: 'seed-1' },
    { slug: 'seed-post-two', id: 'seed-2' },
  ];
  const customPosts = [
    { slug: 'custom-post-one', id: 'custom-1' },
    { slug: 'custom-post-two', id: 'custom-2' },
  ];

  it('returns true for a slug that does not exist anywhere', () => {
    expect(isSlugUnique('brand-new-slug', customPosts, seedPosts)).toBe(true);
  });

  it('returns false for a slug that exists in seed posts', () => {
    expect(isSlugUnique('seed-post-one', customPosts, seedPosts)).toBe(false);
  });

  it('returns false for a slug that exists in custom posts', () => {
    expect(isSlugUnique('custom-post-one', customPosts, seedPosts)).toBe(false);
  });

  it('returns true when the duplicate is the post being edited (excludeId)', () => {
    expect(
      isSlugUnique('custom-post-one', customPosts, seedPosts, 'custom-1')
    ).toBe(true);
  });

  it('returns false when slug matches seed even with excludeId', () => {
    // Seed posts do not use excludeId -- a custom post cannot take a seed slug
    expect(
      isSlugUnique('seed-post-one', customPosts, seedPosts, 'custom-1')
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterPublished (published vs draft filtering)
// ---------------------------------------------------------------------------
describe('filterPublished', () => {
  it('returns only posts with status "published"', () => {
    const posts = [
      { title: 'A', status: 'published' },
      { title: 'B', status: 'draft' },
      { title: 'C', status: 'published' },
    ];
    const result = filterPublished(posts);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.title)).toEqual(['A', 'C']);
  });

  it('returns an empty array when all posts are drafts', () => {
    const posts = [
      { title: 'X', status: 'draft' },
      { title: 'Y', status: 'draft' },
    ];
    expect(filterPublished(posts)).toEqual([]);
  });

  it('returns all posts when all are published', () => {
    const posts = [
      { title: 'A', status: 'published' },
      { title: 'B', status: 'published' },
    ];
    expect(filterPublished(posts)).toHaveLength(2);
  });

  it('handles an empty array', () => {
    expect(filterPublished([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Setup: localStorage mock for news storage tests
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

// ---------------------------------------------------------------------------
// getCustomPosts
// ---------------------------------------------------------------------------
describe('getCustomPosts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('returns an empty array when localStorage is empty', () => {
    expect(getCustomPosts()).toEqual([]);
  });

  it('returns an empty array when stored value is not valid JSON', () => {
    localStorage.setItem('grp-custom-posts-v1', 'not json');
    expect(getCustomPosts()).toEqual([]);
  });

  it('returns an empty array when stored value is not an array', () => {
    localStorage.setItem('grp-custom-posts-v1', '{"not": "array"}');
    expect(getCustomPosts()).toEqual([]);
  });

  it('returns the parsed array when valid JSON array is stored', () => {
    const posts = [{ slug: 'test', title: 'Test' }];
    localStorage.setItem('grp-custom-posts-v1', JSON.stringify(posts));
    expect(getCustomPosts()).toEqual(posts);
  });

  it('returns an empty array when stored value is null JSON', () => {
    localStorage.setItem('grp-custom-posts-v1', 'null');
    expect(getCustomPosts()).toEqual([]);
  });

  it('returns an empty array when stored value is a number', () => {
    localStorage.setItem('grp-custom-posts-v1', '42');
    expect(getCustomPosts()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// setCustomPosts
// ---------------------------------------------------------------------------
describe('setCustomPosts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('stores posts in localStorage', () => {
    const posts = [{ slug: 'hello', title: 'Hello' }];
    setCustomPosts(posts);
    const raw = localStorage.getItem('grp-custom-posts-v1');
    expect(JSON.parse(raw)).toEqual(posts);
  });

  it('roundtrips with getCustomPosts', () => {
    const posts = [
      { slug: 'a', title: 'A', status: 'published' },
      { slug: 'b', title: 'B', status: 'draft' },
    ];
    setCustomPosts(posts);
    expect(getCustomPosts()).toEqual(posts);
  });

  it('overwrites previous data', () => {
    setCustomPosts([{ slug: 'old' }]);
    setCustomPosts([{ slug: 'new' }]);
    expect(getCustomPosts()).toEqual([{ slug: 'new' }]);
  });

  it('stores empty array', () => {
    setCustomPosts([]);
    expect(getCustomPosts()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// postUrl
// ---------------------------------------------------------------------------
describe('postUrl', () => {
  it('constructs URL with slug and page', () => {
    const url = postUrl('my-post', 1);
    expect(url).toBe('./post.html?slug=my-post&page=1');
  });

  it('encodes special characters in slug', () => {
    const url = postUrl('hello world', 2);
    expect(url).toBe('./post.html?slug=hello%20world&page=2');
  });

  it('handles page numbers greater than 1', () => {
    const url = postUrl('test', 3);
    expect(url).toContain('page=3');
  });

  it('encodes ampersands in slug', () => {
    const url = postUrl('a&b', 1);
    expect(url).toContain('slug=a%26b');
  });
});

// ---------------------------------------------------------------------------
// allPosts
// ---------------------------------------------------------------------------
describe('allPosts', () => {
  const seedPosts = [
    { slug: 'seed-1', publishedAt: '2025-01-01', status: 'published' },
    { slug: 'seed-2', publishedAt: '2025-06-01', status: 'published' },
  ];

  it('combines seed and custom posts', () => {
    const custom = [{ slug: 'custom-1', publishedAt: '2025-03-01', status: 'draft' }];
    const result = allPosts(seedPosts, custom);
    expect(result).toHaveLength(3);
  });

  it('sorts combined posts newest first', () => {
    const custom = [{ slug: 'custom-1', publishedAt: '2025-12-01', status: 'published' }];
    const result = allPosts(seedPosts, custom);
    expect(result[0].slug).toBe('custom-1');
    expect(result[result.length - 1].slug).toBe('seed-1');
  });

  it('handles empty custom posts', () => {
    const result = allPosts(seedPosts, []);
    expect(result).toHaveLength(2);
  });

  it('handles empty seed posts', () => {
    const custom = [{ slug: 'custom-1', publishedAt: '2025-03-01', status: 'draft' }];
    const result = allPosts([], custom);
    expect(result).toHaveLength(1);
  });

  it('handles both empty', () => {
    const result = allPosts([], []);
    expect(result).toEqual([]);
  });

  it('does not mutate input arrays', () => {
    const custom = [{ slug: 'custom-1', publishedAt: '2025-03-01', status: 'draft' }];
    const seedCopy = [...seedPosts];
    const customCopy = [...custom];
    allPosts(seedPosts, custom);
    expect(seedPosts).toEqual(seedCopy);
    expect(custom).toEqual(customCopy);
  });
});

// ---------------------------------------------------------------------------
// publishedFromAll
// ---------------------------------------------------------------------------
describe('publishedFromAll', () => {
  it('returns only published posts from combined set', () => {
    const seed = [
      { slug: 's1', publishedAt: '2025-01-01', status: 'published' },
      { slug: 's2', publishedAt: '2025-02-01', status: 'draft' },
    ];
    const custom = [
      { slug: 'c1', publishedAt: '2025-03-01', status: 'published' },
      { slug: 'c2', publishedAt: '2025-04-01', status: 'draft' },
    ];
    const result = publishedFromAll(seed, custom);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.status === 'published')).toBe(true);
  });

  it('returns empty array when no published posts exist', () => {
    const seed = [{ slug: 's1', publishedAt: '2025-01-01', status: 'draft' }];
    const custom = [{ slug: 'c1', publishedAt: '2025-01-01', status: 'draft' }];
    expect(publishedFromAll(seed, custom)).toEqual([]);
  });

  it('sorts published posts newest first', () => {
    const seed = [
      { slug: 's1', publishedAt: '2025-01-01', status: 'published' },
      { slug: 's2', publishedAt: '2025-12-01', status: 'published' },
    ];
    const result = publishedFromAll(seed, []);
    expect(result[0].slug).toBe('s2');
  });
});

// ---------------------------------------------------------------------------
// Post CRUD flows
// ---------------------------------------------------------------------------
describe('Post CRUD via getCustomPosts/setCustomPosts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('creates a post', () => {
    const post = { id: 'custom-1', slug: 'new-post', title: 'New Post' };
    const posts = getCustomPosts();
    posts.push(post);
    setCustomPosts(posts);
    expect(getCustomPosts()).toHaveLength(1);
    expect(getCustomPosts()[0].slug).toBe('new-post');
  });

  it('updates an existing post', () => {
    setCustomPosts([{ id: 'custom-1', slug: 'old', title: 'Old' }]);
    const posts = getCustomPosts();
    const index = posts.findIndex((p) => p.id === 'custom-1');
    posts[index] = { ...posts[index], title: 'Updated' };
    setCustomPosts(posts);
    expect(getCustomPosts()[0].title).toBe('Updated');
  });

  it('deletes a post', () => {
    setCustomPosts([
      { id: 'custom-1', slug: 'a', title: 'A' },
      { id: 'custom-2', slug: 'b', title: 'B' },
    ]);
    const filtered = getCustomPosts().filter((p) => p.id !== 'custom-1');
    setCustomPosts(filtered);
    expect(getCustomPosts()).toHaveLength(1);
    expect(getCustomPosts()[0].id).toBe('custom-2');
  });
});
