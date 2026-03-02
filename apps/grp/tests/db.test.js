import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import knex from 'knex';
import path from 'path';

// Use an in-memory SQLite database for tests
const db = knex({
  client: 'better-sqlite3',
  connection: { filename: ':memory:' },
  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(import.meta.dirname, '../../../db/migrations'),
  },
});

// ---------------------------------------------------------------------------
// Setup: run migrations
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

// ---------------------------------------------------------------------------
// Migration creates all 4 tables
// ---------------------------------------------------------------------------
describe('Migration creates tables', () => {
  it('creates cms_areas table', async () => {
    const exists = await db.schema.hasTable('cms_areas');
    expect(exists).toBe(true);
  });

  it('creates news_posts table', async () => {
    const exists = await db.schema.hasTable('news_posts');
    expect(exists).toBe(true);
  });

  it('creates site_settings table', async () => {
    const exists = await db.schema.hasTable('site_settings');
    expect(exists).toBe(true);
  });

  it('creates asset_registry table', async () => {
    const exists = await db.schema.hasTable('asset_registry');
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// news_posts table has correct columns
// ---------------------------------------------------------------------------
describe('news_posts table columns', () => {
  it('has id column', async () => {
    const exists = await db.schema.hasColumn('news_posts', 'id');
    expect(exists).toBe(true);
  });

  it('has slug column', async () => {
    const exists = await db.schema.hasColumn('news_posts', 'slug');
    expect(exists).toBe(true);
  });

  it('has title column', async () => {
    const exists = await db.schema.hasColumn('news_posts', 'title');
    expect(exists).toBe(true);
  });

  it('has status column', async () => {
    const exists = await db.schema.hasColumn('news_posts', 'status');
    expect(exists).toBe(true);
  });

  it('has published_at column', async () => {
    const exists = await db.schema.hasColumn('news_posts', 'published_at');
    expect(exists).toBe(true);
  });

  it('has body column', async () => {
    const exists = await db.schema.hasColumn('news_posts', 'body');
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cms_areas table has correct columns
// ---------------------------------------------------------------------------
describe('cms_areas table columns', () => {
  it('has id column', async () => {
    const exists = await db.schema.hasColumn('cms_areas', 'id');
    expect(exists).toBe(true);
  });

  it('has page column', async () => {
    const exists = await db.schema.hasColumn('cms_areas', 'page');
    expect(exists).toBe(true);
  });

  it('has area_key column', async () => {
    const exists = await db.schema.hasColumn('cms_areas', 'area_key');
    expect(exists).toBe(true);
  });

  it('has content column', async () => {
    const exists = await db.schema.hasColumn('cms_areas', 'content');
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// site_settings table has correct columns
// ---------------------------------------------------------------------------
describe('site_settings table columns', () => {
  it('has key column', async () => {
    const exists = await db.schema.hasColumn('site_settings', 'key');
    expect(exists).toBe(true);
  });

  it('has value column', async () => {
    const exists = await db.schema.hasColumn('site_settings', 'value');
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// asset_registry table has correct columns
// ---------------------------------------------------------------------------
describe('asset_registry table columns', () => {
  it('has filename column', async () => {
    const exists = await db.schema.hasColumn('asset_registry', 'filename');
    expect(exists).toBe(true);
  });

  it('has original_name column', async () => {
    const exists = await db.schema.hasColumn('asset_registry', 'original_name');
    expect(exists).toBe(true);
  });

  it('has mime_type column', async () => {
    const exists = await db.schema.hasColumn('asset_registry', 'mime_type');
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Can insert and query news_posts
// ---------------------------------------------------------------------------
describe('news_posts CRUD', () => {
  it('can insert a news post', async () => {
    await db('news_posts').insert({
      id: 'test-1',
      slug: 'test-post',
      title: 'Test Post',
      status: 'published',
      published_at: '2025-12-01',
      author: 'Test Author',
      summary: 'A test summary',
      body: JSON.stringify([{ heading: 'H1', body: ['P1'] }]),
      tags: JSON.stringify(['tag1', 'tag2']),
    });
    const rows = await db('news_posts').where({ id: 'test-1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Test Post');
  });

  it('enforces unique slug constraint', async () => {
    await expect(
      db('news_posts').insert({
        id: 'test-2',
        slug: 'test-post', // duplicate slug
        title: 'Duplicate',
        status: 'draft',
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Can insert and query cms_areas
// ---------------------------------------------------------------------------
describe('cms_areas CRUD', () => {
  it('can insert a cms area', async () => {
    await db('cms_areas').insert({
      page: 'index.html',
      area_key: 'hero_main',
      field_type: 'pair',
      content: JSON.stringify({ heading: 'Hello', body: 'World' }),
    });
    const rows = await db('cms_areas').where({ page: 'index.html', area_key: 'hero_main' });
    expect(rows).toHaveLength(1);
    expect(rows[0].field_type).toBe('pair');
  });

  it('enforces unique (page, area_key) constraint', async () => {
    await expect(
      db('cms_areas').insert({
        page: 'index.html',
        area_key: 'hero_main', // duplicate
        field_type: 'pair',
        content: 'duplicate',
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Can insert and query site_settings
// ---------------------------------------------------------------------------
describe('site_settings CRUD', () => {
  it('can insert a site setting', async () => {
    await db('site_settings').insert({
      key: 'site_password',
      value: 'wimbledon',
    });
    const rows = await db('site_settings').where({ key: 'site_password' });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('wimbledon');
  });

  it('can update a site setting', async () => {
    await db('site_settings').where({ key: 'site_password' }).update({ value: 'new-password' });
    const rows = await db('site_settings').where({ key: 'site_password' });
    expect(rows[0].value).toBe('new-password');
  });
});

// ---------------------------------------------------------------------------
// Can insert and query asset_registry
// ---------------------------------------------------------------------------
describe('asset_registry CRUD', () => {
  it('can insert an asset', async () => {
    const [id] = await db('asset_registry').insert({
      filename: 'photo-123.jpg',
      original_name: 'team-photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 204800,
      storage_path: '/uploads/photo-123.jpg',
    });
    expect(id).toBeGreaterThan(0);
    const rows = await db('asset_registry').where({ id });
    expect(rows).toHaveLength(1);
    expect(rows[0].original_name).toBe('team-photo.jpg');
  });
});
