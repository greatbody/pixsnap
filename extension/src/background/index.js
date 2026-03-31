// PixSnap - Background Service Worker
import { getSettings, uploadImage, fetchImageByUrl, fetchImageBlob } from '../utils/api.js';

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'pixsnap-upload',
    title: chrome.i18n.getMessage('contextMenuUpload'),
    contexts: ['image'],
  });

  chrome.contextMenus.create({
    id: 'pixsnap-fetch',
    title: chrome.i18n.getMessage('contextMenuFetch'),
    contexts: ['image'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  const metadata = {
    sourceUrl: tab?.url || '',
    pageTitle: tab?.title || '',
    tags: [],
  };

  try {
    if (info.menuItemId === 'pixsnap-upload') {
      await captureLocal(imageUrl, metadata);
    } else if (info.menuItemId === 'pixsnap-fetch') {
      await captureRemote(imageUrl, metadata);
    }
  } catch (err) {
    console.error('[PixSnap]', err);
    notifyUser('Capture failed', err.message);
  }
});

/**
 * Mode 1: Fetch the image in the browser and upload the binary
 */
async function captureLocal(imageUrl, metadata) {
  notifyUser('Capturing...', 'Downloading image locally...');

  const blob = await fetchImageBlob(imageUrl);
  const result = await uploadImage(blob, metadata);

  addToRecent(result);
  notifyUser('Captured!', `Image saved (${(blob.size / 1024).toFixed(1)} KB)`);
}

/**
 * Mode 2: Send the URL to the Worker for server-side fetch
 */
async function captureRemote(imageUrl, metadata) {
  notifyUser('Capturing...', 'Sending URL to server...');

  const result = await fetchImageByUrl(imageUrl, metadata);

  addToRecent(result);
  notifyUser('Captured!', 'Image fetched by server.');
}

/**
 * Store recent captures in local storage (last 20)
 */
async function addToRecent(imageData) {
  const { recentCaptures = [] } = await chrome.storage.local.get('recentCaptures');
  recentCaptures.unshift({
    id: imageData.id,
    filename: imageData.filename,
    content_type: imageData.content_type,
    size: imageData.size,
    created_at: imageData.created_at,
    capture_mode: imageData.capture_mode,
  });

  // Keep only last 20
  if (recentCaptures.length > 20) {
    recentCaptures.length = 20;
  }

  await chrome.storage.local.set({ recentCaptures });
}

/**
 * Show a browser notification
 */
function notifyUser(title, message) {
  // Use chrome.action.setBadgeText for lightweight feedback
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 3000);

  // Log to console for debugging
  console.log(`[PixSnap] ${title}: ${message}`);
}

// Listen for messages from popup/gallery
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'capture-local') {
    captureLocal(message.imageUrl, message.metadata)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.type === 'capture-remote') {
    captureRemote(message.imageUrl, message.metadata)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-recent') {
    chrome.storage.local.get('recentCaptures')
      .then(data => sendResponse({ success: true, data: data.recentCaptures || [] }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
