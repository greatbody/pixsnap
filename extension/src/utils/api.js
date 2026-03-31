// PixSnap - Shared utility functions

/**
 * Generate a UUID v4
 */
export function uuid() {
  return crypto.randomUUID();
}

/**
 * Get stored settings from chrome.storage.sync
 */
export async function getSettings() {
  const defaults = {
    workerUrl: '',
    apiToken: '',
    defaultMode: 'local', // 'local' | 'remote'
  };
  const stored = await chrome.storage.sync.get(defaults);
  return stored;
}

/**
 * Save settings to chrome.storage.sync
 */
export async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}

/**
 * Make an authenticated request to the Worker API
 */
export async function apiRequest(path, options = {}) {
  const { workerUrl, apiToken } = await getSettings();
  if (!workerUrl || !apiToken) {
    throw new Error('PixSnap is not configured. Please set Worker URL and API Token in settings.');
  }

  const url = `${workerUrl.replace(/\/+$/, '')}${path}`;
  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${text || response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

/**
 * Upload an image binary to the Worker
 */
export async function uploadImage(blob, metadata = {}) {
  const formData = new FormData();
  const ext = mimeToExt(blob.type) || 'bin';
  const filename = metadata.filename || `capture-${Date.now()}.${ext}`;
  formData.append('file', blob, filename);

  if (metadata.sourceUrl) formData.append('source_url', metadata.sourceUrl);
  if (metadata.pageTitle) formData.append('page_title', metadata.pageTitle);
  if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));

  return apiRequest('/api/images/upload', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Send an image URL to the Worker for server-side fetch
 */
export async function fetchImageByUrl(imageUrl, metadata = {}) {
  return apiRequest('/api/images/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      source_url: metadata.sourceUrl || '',
      page_title: metadata.pageTitle || '',
      tags: metadata.tags || [],
    }),
  });
}

/**
 * Fetch image as blob from a URL (browser-side)
 */
export async function fetchImageBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.blob();
}

/**
 * Map MIME type to file extension
 */
export function mimeToExt(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/avif': 'avif',
    'image/tiff': 'tiff',
  };
  return map[mime] || null;
}

/**
 * Format file size for display
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format ISO date for display
 */
export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
