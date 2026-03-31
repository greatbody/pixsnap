# PixSnap - Design Document

## Overview

PixSnap is a self-hosted image collection system consisting of a Chrome extension and a Cloudflare Worker backend. It allows users to capture images from web pages and store them in their own Cloudflare infrastructure with full privacy control.

## Architecture

```
+-------------------+          +------------------------+
|  Chrome Extension  |  HTTPS  |   Cloudflare Worker    |
|                    +-------->|                        |
|  - Right-click     |         |  - REST API            |
|  - Popup UI        |         |  - R2 Object Storage   |
|  - Gallery page    |         |  - D1 SQLite Database  |
|  - Local capture   |         |  - Remote fetch        |
+-------------------+          +------------------------+
```

## Collection Modes

### Mode 1: Local Capture (Browser Upload)

1. User right-clicks an image or selects from popup
2. Extension fetches the image binary in the browser
3. Extension uploads the binary (as `multipart/form-data`) to the Worker
4. Worker stores the image in R2 and metadata in D1

**Use case**: When the image requires cookies/auth that the server cannot access, or when the user wants to ensure exact capture of what they see.

### Mode 2: URL Delegation (Server Fetch)

1. User right-clicks an image or selects from popup
2. Extension sends only the image URL to the Worker
3. Worker fetches the image from the source URL
4. Worker stores the image in R2 and metadata in D1

**Use case**: Saves bandwidth on the client side; works well for publicly accessible images.

## Data Model

### D1 Schema: `images`

| Column       | Type    | Description                          |
|--------------|---------|--------------------------------------|
| id           | TEXT PK | UUID v4                              |
| filename     | TEXT    | Original or generated filename       |
| content_type | TEXT    | MIME type (image/png, image/jpeg...) |
| size         | INTEGER | File size in bytes                   |
| width        | INTEGER | Image width (if detectable)          |
| height       | INTEGER | Image height (if detectable)         |
| source_url   | TEXT    | Original page URL                    |
| page_title   | TEXT    | Title of the source page             |
| r2_key       | TEXT    | Object key in R2 bucket              |
| tags         | TEXT    | JSON array of user-defined tags      |
| capture_mode | TEXT    | "local" or "remote"                  |
| created_at   | TEXT    | ISO 8601 timestamp                   |

### R2 Storage

- Bucket: `pixsnap-images`
- Key format: `{year}/{month}/{id}.{ext}`
- Images served via Worker with optional signed URLs

## API Design

All endpoints require `Authorization: Bearer <token>` header.

### `POST /api/images/upload`

Upload image binary from browser.

- Content-Type: `multipart/form-data`
- Fields: `file`, `source_url`, `page_title`, `tags`
- Response: `201 Created` with image metadata

### `POST /api/images/fetch`

Delegate image fetching to the worker.

- Content-Type: `application/json`
- Body: `{ "url": "...", "source_url": "...", "page_title": "...", "tags": [] }`
- Response: `201 Created` with image metadata

### `GET /api/images`

List images with pagination and filtering.

- Query: `?page=1&limit=20&tag=landscape&search=sunset`
- Response: paginated image metadata list

### `GET /api/images/:id`

Get single image metadata.

### `GET /api/images/:id/file`

Stream the actual image binary from R2.

### `DELETE /api/images/:id`

Delete image from both R2 and D1.

### `PATCH /api/images/:id`

Update image metadata (tags, etc.).

### `GET /api/tags`

List all unique tags with counts.

## Chrome Extension

### Manifest V3

- **Background**: Service worker handles API communication
- **Content Script**: Detects images on page, enables selection
- **Popup**: Quick capture UI, settings, recent captures
- **Gallery Page**: Full-page SPA for browsing collected images

### Context Menu

- "Capture image (upload)" - Mode 1
- "Capture image (URL)" - Mode 2
- On any image element in the page

### Popup UI

- Status indicator (connected/disconnected to worker)
- Recent captures (last 5)
- Quick settings access
- Manual URL input for capture

### Gallery Page (`gallery.html`)

A full single-page application accessible via the extension that provides:

- **Grid view**: Masonry-style image grid with lazy loading
- **List view**: Compact list with thumbnails and metadata
- **Detail view**: Full-size image with metadata sidebar
- **Search**: Full-text search across tags and page titles
- **Tag filter**: Click tags to filter, multi-tag support
- **Bulk operations**: Select multiple images, bulk delete/tag
- **Infinite scroll**: Load more images as user scrolls
- **Keyboard navigation**: Arrow keys, Enter to open, Escape to close

## Security & Privacy

### Authentication

- Simple bearer token authentication (user-defined secret)
- Token stored in extension's `chrome.storage.sync`
- No third-party auth services

### Privacy by Design

- No analytics or telemetry
- No external service dependencies beyond Cloudflare
- Source URLs and page titles are optional metadata
- All data stored in user's own Cloudflare account
- No user accounts or registration
- `.env` and secrets excluded from version control
- R2 bucket is private; images served only through authenticated Worker

### CORS

- Worker allows requests only from the extension origin
- Configurable allowed origins for self-hosted gallery

## Configuration

### Extension Settings

```
Worker URL:     https://pixsnap.your-domain.workers.dev
API Token:      <user-defined-secret>
Default Mode:   local | remote
```

### Worker Environment Variables

```
API_TOKEN:      Authentication token (Cloudflare secret)
ALLOWED_ORIGINS: Comma-separated allowed origins
```

### Worker Bindings

```
R2:  IMAGES_BUCKET (pixsnap-images)
D1:  IMAGES_DB
```

## Tech Stack

| Component   | Technology                     |
|-------------|--------------------------------|
| Extension   | Vanilla JS + Manifest V3       |
| Worker      | Cloudflare Workers (TypeScript) |
| Database    | Cloudflare D1 (SQLite)          |
| Storage     | Cloudflare R2                   |
| Build       | wrangler (Worker), none (ext)   |
| Gallery UI  | Vanilla JS + CSS Grid           |
