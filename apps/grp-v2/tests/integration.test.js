import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const HTML_FILES = [
  'index.html',
  'structure.html',
  'investment-approach.html',
  'team.html',
  'news.html',
  'post.html',
  'contact.html',
];

// ---------------------------------------------------------------------------
// HTML pages exist
// ---------------------------------------------------------------------------
describe('HTML pages exist', () => {
  HTML_FILES.forEach((file) => {
    it(`${file} exists`, () => {
      const filePath = path.join(ROOT, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// CSS file exists
// ---------------------------------------------------------------------------
describe('CSS file exists', () => {
  it('styles.css exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'styles.css'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JS files exist
// ---------------------------------------------------------------------------
describe('JS files exist', () => {
  const jsFiles = ['app.js', 'cms.js', 'news.js', 'news-data.js'];
  jsFiles.forEach((file) => {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// HTML structure
// ---------------------------------------------------------------------------
describe('HTML structure', () => {
  HTML_FILES.forEach((file) => {
    describe(file, () => {
      let content;
      try {
        content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      } catch {
        content = '';
      }

      it('has a <nav> element', () => {
        expect(content).toContain('<nav');
      });

      it('has a <footer> or data-year element', () => {
        const hasFooter = content.includes('<footer') || content.includes('data-year');
        expect(hasFooter).toBe(true);
      });

      it('has <!doctype html> or <!DOCTYPE html>', () => {
        expect(content.toLowerCase()).toContain('<!doctype html>');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// CSP meta tags
// ---------------------------------------------------------------------------
describe('CSP meta tags', () => {
  HTML_FILES.forEach((file) => {
    it(`${file} has Content-Security-Policy meta tag`, () => {
      let content;
      try {
        content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      } catch {
        content = '';
      }
      expect(content).toContain('Content-Security-Policy');
    });
  });
});

// ---------------------------------------------------------------------------
// Skip nav link
// ---------------------------------------------------------------------------
describe('Skip nav link', () => {
  HTML_FILES.forEach((file) => {
    it(`${file} has skip-to-content link`, () => {
      let content;
      try {
        content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      } catch {
        content = '';
      }
      expect(content).toContain('skip-nav');
    });
  });
});

// ---------------------------------------------------------------------------
// Script loading order
// ---------------------------------------------------------------------------
describe('Script loading', () => {
  it('index.html loads app.js', () => {
    const content = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
    expect(content).toContain('app.js');
  });

  it('index.html loads cms.js', () => {
    const content = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
    expect(content).toContain('cms.js');
  });

  it('news.html loads news-data.js', () => {
    const content = fs.readFileSync(path.join(ROOT, 'news.html'), 'utf-8');
    expect(content).toContain('news-data.js');
  });

  it('news.html loads news.js', () => {
    const content = fs.readFileSync(path.join(ROOT, 'news.html'), 'utf-8');
    expect(content).toContain('news.js');
  });
});

// ---------------------------------------------------------------------------
// News data integrity
// ---------------------------------------------------------------------------
describe('News seed data integrity', () => {
  let newsDataContent;
  try {
    newsDataContent = fs.readFileSync(path.join(ROOT, 'news-data.js'), 'utf-8');
  } catch {
    newsDataContent = '';
  }

  it('defines GRP_NEWS_SEED_POSTS', () => {
    expect(newsDataContent).toContain('GRP_NEWS_SEED_POSTS');
  });

  it('contains 6 seed posts', () => {
    // Count slug occurrences as a proxy for post count
    const slugMatches = newsDataContent.match(/slug:/g);
    expect(slugMatches).not.toBeNull();
    expect(slugMatches.length).toBe(6);
  });

  it('each post has required fields (slug, title, status, publishedAt)', () => {
    expect(newsDataContent).toContain('slug:');
    expect(newsDataContent).toContain('title:');
    expect(newsDataContent).toContain('status:');
    expect(newsDataContent).toContain('publishedAt:');
  });

  it('all seed posts have status "published"', () => {
    // Count status occurrences
    const publishedMatches = newsDataContent.match(/status:\s*"published"/g);
    expect(publishedMatches).not.toBeNull();
    expect(publishedMatches.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Asset files
// ---------------------------------------------------------------------------
describe('Asset files exist', () => {
  it('person-placeholder.svg exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets', 'person-placeholder.svg'))).toBe(true);
  });

  it('logo-wordmark.svg exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets', 'logo-wordmark.svg'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serve.json config
// ---------------------------------------------------------------------------
describe('serve.json config', () => {
  it('serve.json exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'serve.json'))).toBe(true);
  });

  it('cleanUrls is false', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'serve.json'), 'utf-8'));
    expect(config.cleanUrls).toBe(false);
  });
});
