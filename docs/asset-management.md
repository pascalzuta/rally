# Asset Management

Green Room Partners website asset management strategy, covering local
development workflows and cloud production deployment.

---

## 1. Overview

The GRP site uses a **two-tier asset management strategy**:

| Tier | Purpose | Storage | Delivery |
|------|---------|---------|----------|
| **Local development** | Rapid iteration, preview builds | `assets/originals/` and `assets/optimized/` | Static file serving (`serve`, Netlify Dev) |
| **Cloud production** | Live site delivery | AWS S3 | CloudFront CDN |

Both tiers share the same sharp-based optimization pipeline. Locally you run
`npm run assets:optimize` on your machine. In the cloud, a Lambda function runs
the same logic whenever a new file is uploaded to S3.

---

## 2. Local Development Workflow

### 2.1 Asset Pipeline Architecture

```
+-------------------+     +--------------------+     +-----------------------+
|  Raw Upload       |     |  sharp Pipeline     |     |  Optimized Assets     |
|                   |     |                     |     |                       |
| assets/originals/ |---->| optimize-images.mjs |---->| assets/optimized/     |
|                   |     |                     |     |                       |
| - hero.jpg        |     | - Resize (4 sizes)  |     | - hero-a1b2-320.webp  |
| - team-photo.png  |     | - Convert (WebP +   |     | - hero-a1b2-320.jpg   |
| - office.webp     |     |   JPEG)             |     | - hero-a1b2-800.webp  |
|                   |     | - Content-hash      |     | - manifest.json       |
+-------------------+     +--------------------+     +-----------------------+
```

### 2.2 Adding New Images

1. Place the original, full-resolution image in `assets/originals/`.
2. Run the optimization pipeline:
   ```bash
   npm run assets:optimize
   ```
3. The script generates up to 8 variants per image (4 sizes x 2 formats) and
   writes them to `assets/optimized/`.
4. A `assets/manifest.json` file is created mapping each original filename to
   its generated variants.

Supported input formats: **JPEG, PNG, WebP, AVIF, TIFF**.
SVG files are skipped because they are resolution-independent and do not benefit
from raster resizing.

### 2.3 Size Variants

| Variant | Width | Use Case |
|---------|-------|----------|
| `thumbnail` | 320 px | Cards, small previews, mobile thumbnails |
| `medium` | 800 px | Content images, tablet layouts |
| `large` | 1600 px | Hero backgrounds, full-width sections |
| `original` | Full size | Retina displays, zoom overlays |

The script **never upscales**: if an original image is 500 px wide, only the
`thumbnail` and `original` variants are generated.

### 2.4 Format Variants

| Format | Extension | Quality | Purpose |
|--------|-----------|---------|---------|
| WebP | `.webp` | 80 | Primary format, smallest file size |
| JPEG | `.jpg` | 85 | Fallback for older browsers |

### 2.5 How manifest.json Works

After running the pipeline, `assets/manifest.json` contains a mapping from each
original filename to its optimized variants:

```json
{
  "hero-banner.jpg": {
    "thumbnail": {
      "webp": "hero-banner-a1b2c3d4-320.webp",
      "jpeg": "hero-banner-a1b2c3d4-320.jpg"
    },
    "medium": {
      "webp": "hero-banner-a1b2c3d4-800.webp",
      "jpeg": "hero-banner-a1b2c3d4-800.jpg"
    },
    "large": {
      "webp": "hero-banner-a1b2c3d4-1600.webp",
      "jpeg": "hero-banner-a1b2c3d4-1600.jpg"
    },
    "original": {
      "webp": "hero-banner-a1b2c3d4-full.webp",
      "jpeg": "hero-banner-a1b2c3d4-full.jpg"
    }
  }
}
```

Build tooling or templating can read this manifest to emit the correct
`<picture>` / `srcset` markup automatically.

### 2.6 Referencing Optimized Images in HTML/CSS

**Responsive `<picture>` element (recommended):**

```html
<picture>
  <source
    type="image/webp"
    srcset="
      assets/optimized/hero-a1b2c3d4-320.webp   320w,
      assets/optimized/hero-a1b2c3d4-800.webp   800w,
      assets/optimized/hero-a1b2c3d4-1600.webp 1600w
    "
    sizes="(max-width: 600px) 100vw, (max-width: 1200px) 80vw, 1600px"
  />
  <img
    src="assets/optimized/hero-a1b2c3d4-800.jpg"
    srcset="
      assets/optimized/hero-a1b2c3d4-320.jpg   320w,
      assets/optimized/hero-a1b2c3d4-800.jpg   800w,
      assets/optimized/hero-a1b2c3d4-1600.jpg 1600w
    "
    sizes="(max-width: 600px) 100vw, (max-width: 1200px) 80vw, 1600px"
    alt="Descriptive alt text"
    loading="lazy"
    decoding="async"
  />
</picture>
```

**CSS background (hero sections):**

```css
.hero--home {
  background: url("assets/optimized/hero-a1b2c3d4-1600.webp") center/cover;
}
```

### 2.7 Content-Hash Caching

Filenames contain an 8-character hash derived from the file content
(`SHA-256`). This enables aggressive, long-lived cache headers:

```
Cache-Control: public, max-age=31536000, immutable
```

When the source image changes, the hash changes, the filename changes, and
browsers fetch the new version automatically. No cache invalidation required.

---

## 3. Cloud Asset Management (AWS)

### 3.1 S3 + CloudFront Architecture

```
+-----------+   Pre-signed URL   +--------------+   S3 Event   +-------------+
|  Browser  |------------------>|     S3        |------------->|   Lambda    |
|  Upload   |                   |  originals/   |              |  (sharp)    |
+-----------+                   +--------------+              +------+------+
                                                                      |
                                                               +------v------+
                                                               |     S3      |
                                                               |  optimized/ |
                                                               +------+------+
                                                                      |
+-----------+                   +--------------+                      |
|  Browser  |<-----------------|  CloudFront   |<---------------------+
|  (user)   |   Cached resp.   |  (CDN)        |
+-----------+                   +--------------+
```

### 3.2 S3 Bucket Structure

```
grp-assets-{env}/
  originals/          # Raw uploads (write-only from client)
  optimized/          # Pipeline output (read-only from client)
  manifest.json       # Variant mapping
```

Bucket naming convention: `grp-assets-production`, `grp-assets-staging`.

Enable **S3 Versioning** for accidental deletion recovery. Apply a lifecycle
rule to expire non-current versions after 90 days.

### 3.3 CloudFront Distribution Configuration

| Setting | Value |
|---------|-------|
| Origin | S3 bucket (`grp-assets-production`) |
| Origin access | Origin Access Control (OAC), not legacy OAI |
| Default TTL | 86400 (1 day) |
| Max TTL | 31536000 (1 year) |
| Viewer protocol | Redirect HTTP to HTTPS |
| Compress | Yes (Brotli + Gzip) |
| Price class | Use only North America + Europe |
| Alternate domain | `assets.greenroompartners.com` |
| SSL certificate | ACM certificate for `*.greenroompartners.com` |

### 3.4 Cache-Control Headers Strategy

| Path Pattern | Cache-Control | Rationale |
|--------------|---------------|-----------|
| `optimized/*-*.*` (hashed) | `public, max-age=31536000, immutable` | Content-hash guarantees uniqueness |
| `originals/*` | `private, no-store` | Raw files are not served directly |
| `manifest.json` | `public, max-age=60, stale-while-revalidate=300` | Must stay fresh for build tooling |

Set these headers via S3 object metadata at upload time or via a CloudFront
response headers policy.

### 3.5 Pre-Signed Upload URL Flow

1. Client requests a pre-signed PUT URL from the GRP API.
2. API generates a time-limited (15 min) pre-signed URL scoped to
   `originals/{uuid}-{filename}`.
3. Client uploads directly to S3 using the pre-signed URL.
4. S3 emits an `s3:ObjectCreated:*` event to trigger the Lambda.

This avoids routing large files through the API server and keeps upload
credentials out of the browser.

### 3.6 Lambda for Image Optimization

A Lambda function (Node.js 20.x runtime, 1024 MB memory, 60 s timeout)
subscribes to S3 events on the `originals/` prefix:

1. Download the uploaded file from `originals/`.
2. Run the same sharp pipeline used locally (4 sizes x 2 formats).
3. Upload variants to `optimized/` with content-hash filenames.
4. Update `manifest.json` (read-modify-write with optimistic locking).

Package sharp as a Lambda layer or bundle with `@img/sharp-linux-x64` for
the Lambda execution environment.

### 3.7 CloudFront Cache Invalidation

Because optimized assets use content-hash filenames, cache invalidation is
rarely needed. The only file requiring periodic invalidation is
`manifest.json`:

```bash
aws cloudfront create-invalidation \
  --distribution-id E1234EXAMPLE \
  --paths "/manifest.json"
```

For emergency full-site invalidation:
```bash
aws cloudfront create-invalidation \
  --distribution-id E1234EXAMPLE \
  --paths "/*"
```

### 3.8 Cost Considerations

| Service | Estimated Monthly Cost | Notes |
|---------|----------------------|-------|
| S3 storage | < $1 | ~100 images, multiple variants |
| S3 requests | < $1 | Low write volume |
| Lambda invocations | < $1 | Triggered only on upload |
| CloudFront data transfer | $5-20 | Depends on traffic volume |
| CloudFront requests | $1-5 | Per-request pricing |

Total estimated cost: **$10-30/month** for a typical low-traffic corporate site.

---

## 4. Migration Plan

The site currently loads images from Pexels URLs. Migrating to self-hosted
assets involves five steps:

### Step 1: Download Current Pexels Images

All Pexels URLs currently used as defaults across the project:

**Hero Background Images (CSS custom properties):**

| Page | Variable | Pexels Photo ID |
|------|----------|----------------|
| Home (`index.html`) | `--hero-home-image` | 1295138 |
| Structure (`structure.html`) | `--hero-structure-image` | 167698 |
| Investment Approach (`investment-approach.html`) | `--hero-investment-image` | 28610678 |
| Team (`team.html`) | `--hero-team-image` | 208745 |
| News (`news.html`) | `--hero-news-image` | 518543 |

**Content Images (inline `<img>` elements and CMS defaults):**

| Page | Section | Pexels Photo ID | Description |
|------|---------|----------------|-------------|
| Home | Mission | 6770610 | Financial analytics dashboard |
| Home | Sector 1 | 221047 | Container shipping infrastructure |
| Home | Sector 2 | 2280571 | Laboratory instruments |
| Structure | Alignment | 957024 | Forest perspective |
| Investment | Execution | 1271619 | Climber on vertical route |

**Legacy replacement images (HOME_IMAGE_REPLACEMENTS in cms.js):**

| Pexels Photo ID | Status |
|----------------|--------|
| 7567560 | Replaced by 325229 |
| 325229 | Replaced by 6770610 |
| 256381 | Replaced by 221047 |
| 4386467 | Replaced by 3952234 |
| 373543 | Replaced by 3952234 |
| 3952234 | Replaced by 2280571 |

### Step 2: Run Through Optimization Pipeline

```bash
# Download each Pexels image to assets/originals/
curl -L "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=2400" \
  -o assets/originals/hero-home.jpg

# ... repeat for each image ...

# Generate all variants
npm run assets:optimize
```

### Step 3: Update CSS Custom Property Defaults

Replace Pexels URLs in `styles.css` with local optimized paths:

```css
/* Before */
.hero--home {
  background: var(--hero-home-image,
    url("https://images.pexels.com/photos/1295138/...")) center 42% / cover;
}

/* After */
.hero--home {
  background: var(--hero-home-image,
    url("assets/optimized/hero-home-a1b2c3d4-1600.webp")) center 42% / cover;
}
```

### Step 4: Update CMS_CONFIG defaultValue Entries

Update `cms.js` CMS_CONFIG entries to reference local optimized files instead
of Pexels URLs:

```javascript
// Before
{ key: "hero_image", ..., defaultValue: "https://images.pexels.com/..." }

// After
{ key: "hero_image", ..., defaultValue: "assets/optimized/hero-home-a1b2c3d4-1600.webp" }
```

The `HOME_IMAGE_REPLACEMENTS` map can be removed entirely once migration is
complete.

### Step 5: Deploy Optimized Assets to S3

```bash
# Sync optimized assets to S3
aws s3 sync assets/optimized/ s3://grp-assets-production/optimized/ \
  --cache-control "public, max-age=31536000, immutable"

# Upload manifest
aws s3 cp assets/manifest.json s3://grp-assets-production/manifest.json \
  --cache-control "public, max-age=60, stale-while-revalidate=300"

# Update HTML/CSS to use CloudFront URLs
# assets/optimized/hero-... -> https://assets.greenroompartners.com/optimized/hero-...
```

---

## 5. CMS Integration

### 5.1 Current Architecture

The CMS (`cms.js`) stores image URLs in `localStorage` under the key
`grp-cms-areas-v4`. When the page loads, the CMS applies overrides to DOM
elements and CSS custom properties.

- Images are loaded directly from Pexels URLs.
- URL changes take effect immediately in the browser.
- No image processing or optimization occurs at the CMS layer.

### 5.2 Future Architecture

The CMS will gain an **asset picker** component:

1. **Upload**: User selects an image file in the CMS panel.
2. **Pre-signed URL**: CMS requests a pre-signed S3 PUT URL from the API.
3. **Direct upload**: Browser uploads the image directly to S3 `originals/`.
4. **Lambda processing**: S3 event triggers the optimization Lambda.
5. **Manifest update**: Lambda updates `manifest.json` with new variants.
6. **Asset picker**: CMS reads `manifest.json` and shows available images
   with thumbnails.
7. **Selection**: User picks an image; CMS stores the CloudFront URL in
   `localStorage`.
8. **Delivery**: Browser loads the optimized image via CloudFront.

This eliminates reliance on third-party image hosts and gives full control
over image quality, format, and caching.

---

## 6. Best Practices

### 6.1 Image Format Selection

| Format | Best For | Notes |
|--------|----------|-------|
| **WebP** | All raster images | 25-35% smaller than JPEG at equivalent quality |
| **JPEG** | Fallback for older browsers | Universal support, good for photos |
| **PNG** | Screenshots, images with transparency | Lossless but large for photos |
| **SVG** | Logos, icons, line art | Resolution-independent, tiny file size |
| **AVIF** | Future consideration | Better compression than WebP, growing support |

Use SVG for the GRP logo (`logo-wordmark-v5.svg`) and person placeholder.
Use the WebP/JPEG pipeline for all photographic content.

### 6.2 Responsive Images with srcset and sizes

Always provide multiple sizes and let the browser choose:

```html
<img
  src="assets/optimized/photo-a1b2c3d4-800.jpg"
  srcset="
    assets/optimized/photo-a1b2c3d4-320.jpg   320w,
    assets/optimized/photo-a1b2c3d4-800.jpg   800w,
    assets/optimized/photo-a1b2c3d4-1600.jpg 1600w
  "
  sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 800px"
  alt="Description of the image"
  loading="lazy"
  decoding="async"
/>
```

The `sizes` attribute tells the browser how wide the image will be rendered,
so it can select the smallest adequate file from `srcset`.

### 6.3 Lazy Loading

Add `loading="lazy"` to all images below the fold:

```html
<img src="photo.jpg" alt="..." loading="lazy" decoding="async" />
```

Do **not** lazy-load the hero image or any above-the-fold content. These
should load eagerly for best Largest Contentful Paint (LCP).

### 6.4 Art Direction with `<picture>`

Use `<picture>` when different crops are needed at different breakpoints:

```html
<picture>
  <source media="(max-width: 600px)" srcset="photo-mobile.webp" type="image/webp" />
  <source media="(max-width: 600px)" srcset="photo-mobile.jpg" />
  <source srcset="photo-desktop.webp" type="image/webp" />
  <img src="photo-desktop.jpg" alt="Description" />
</picture>
```

### 6.5 Maximum File Size Budgets

| Variant | Max Size | Rationale |
|---------|----------|-----------|
| Thumbnail (320w) | 30 KB | Mobile data connections |
| Medium (800w) | 100 KB | Tablet and content images |
| Large (1600w) | 250 KB | Desktop hero images |
| Original (full) | 500 KB | Retina and zoom views |

If an optimized image exceeds these budgets, consider lowering the quality
setting or resizing the source image.

### 6.6 Accessibility

- **Always provide `alt` text.** Every `<img>` must have a meaningful `alt`
  attribute describing the image content.
- Decorative images (purely visual, no information) should use `alt=""` and
  `role="presentation"`.
- Hero background images set via CSS do not need `alt` text but should have
  appropriate ARIA labels on their container if they convey meaning.
- Avoid text in images. If unavoidable, ensure the text is also present in
  the HTML as visible or screen-reader-accessible content.
- Ensure sufficient color contrast between text overlaid on images and the
  image background. Use a semi-transparent overlay when needed.
