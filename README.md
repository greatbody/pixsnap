# PixSnap

A self-hosted image collection system. Capture images from the web using a Chrome extension and store them in your own Cloudflare infrastructure (R2 + D1).

## Features

- **Two capture modes**: Upload from browser or delegate fetching to the server
- **Right-click capture**: Context menu on any image in any web page
- **Hover overlay**: Quick-capture buttons appear when hovering over images
- **Gallery viewer**: Full-featured SPA with grid/list views, search, tags, and lightbox
- **Privacy-first**: No analytics, no telemetry, all data in your own Cloudflare account
- **Simple auth**: Bearer token authentication, no third-party services

## Architecture

```
extension/     Chrome Extension (Manifest V3)
  ├── src/
  │   ├── background/    Service worker
  │   ├── content/       Image detection overlay
  │   ├── popup/         Quick capture UI
  │   ├── gallery/       Full-page image browser
  │   └── utils/         Shared API utilities
  └── icons/

worker/        Cloudflare Worker (TypeScript)
  ├── src/
  │   ├── routes/        API endpoint handlers
  │   ├── services/      R2 storage logic
  │   └── middleware/    Auth & CORS
  └── migrations/        D1 schema
```

## Setup

### 1. Deploy the Worker

```bash
cd worker
npm install

# Create D1 database
wrangler d1 create pixsnap-db
# Copy the database_id into wrangler.toml

# Create R2 bucket
wrangler r2 bucket create pixsnap-images

# Set the API token secret
wrangler secret put API_TOKEN

# Run database migration
npm run db:migrate

# Deploy
npm run deploy
```

### 2. Install the Extension

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. Click the PixSnap icon and configure:
   - **Worker URL**: Your deployed worker URL
   - **API Token**: The token you set as a secret

## Usage

- **Right-click** any image on a web page to capture it
- **Hover** over an image to see quick-capture buttons
- **Popup**: Paste a URL to manually capture an image
- **Gallery**: Click "Open Gallery" in the popup for full browsing

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (no auth) |
| POST | `/api/images/upload` | Upload image binary |
| POST | `/api/images/fetch` | Fetch image by URL |
| GET | `/api/images` | List images (paginated) |
| GET | `/api/images/:id` | Get image metadata |
| GET | `/api/images/:id/file` | Stream image binary |
| PATCH | `/api/images/:id` | Update metadata/tags |
| DELETE | `/api/images/:id` | Delete image |
| GET | `/api/tags` | List tags with counts |

## License

MIT
