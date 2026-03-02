/**
 * Initial schema for the GRP CMS database.
 * Creates tables for CMS content areas, news posts, site settings, and asset registry.
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('cms_areas', (table) => {
      table.increments('id').primary();
      table.string('page').notNullable().index();
      table.string('area_key').notNullable();
      table.string('field_type').notNullable();
      table.text('content'); // JSON stored as text
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['page', 'area_key']);
    })
    .createTable('news_posts', (table) => {
      table.string('id').primary(); // matches custom-{timestamp} pattern
      table.string('slug').unique().notNullable();
      table.string('title').notNullable();
      table.string('month_key');
      table.text('summary');
      table.text('body'); // JSON array of pages stored as text
      table.text('tags'); // JSON array stored as text
      table.string('hero_image');
      table.string('author');
      table.string('status').defaultTo('draft');
      table.string('published_at'); // ISO date string
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('site_settings', (table) => {
      table.string('key').primary();
      table.text('value');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('asset_registry', (table) => {
      table.increments('id').primary();
      table.string('filename').notNullable();
      table.string('original_name').notNullable();
      table.string('mime_type');
      table.integer('size_bytes');
      table.text('variants'); // JSON stored as text
      table.string('storage_path');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('asset_registry')
    .dropTableIfExists('site_settings')
    .dropTableIfExists('news_posts')
    .dropTableIfExists('cms_areas');
};
