// PixSnap - Popup Script
import { getSettings, saveSettings, apiRequest, formatSize } from '../utils/api.js';

const $ = (sel) => document.querySelector(sel);

// Views
const viewMain = $('#view-main');
const viewSettings = $('#view-settings');

// Elements
const statusDot = $('#status-dot');
const manualUrl = $('#manual-url');
const btnUpload = $('#btn-upload');
const btnFetch = $('#btn-fetch');
const btnGallery = $('#btn-gallery');
const btnSettings = $('#btn-settings');
const btnSaveSettings = $('#btn-save-settings');
const btnBack = $('#btn-back');
const recentList = $('#recent-list');
const settingWorkerUrl = $('#setting-worker-url');
const settingApiToken = $('#setting-api-token');
const settingDefaultMode = $('#setting-default-mode');

// Initialize
async function init() {
  const settings = await getSettings();

  // Check connection status
  if (settings.workerUrl && settings.apiToken) {
    try {
      await apiRequest('/api/health');
      statusDot.className = 'status-dot connected';
      statusDot.title = 'Connected';
    } catch {
      statusDot.className = 'status-dot error';
      statusDot.title = 'Connection failed';
    }
  }

  // Load settings into form
  settingWorkerUrl.value = settings.workerUrl || '';
  settingApiToken.value = settings.apiToken || '';
  settingDefaultMode.value = settings.defaultMode || 'local';

  // Load recent captures
  loadRecent();
}

async function loadRecent() {
  chrome.runtime.sendMessage({ type: 'get-recent' }, (response) => {
    if (!response?.success || !response.data?.length) {
      recentList.innerHTML = '<p class="muted">No captures yet.</p>';
      return;
    }

    recentList.innerHTML = response.data.slice(0, 5).map(item => `
      <div class="recent-item">
        <span class="dot ${item.capture_mode || 'local'}"></span>
        <span class="name">${escapeHtml(item.filename || 'untitled')}</span>
        <span class="size">${item.size ? formatSize(item.size) : ''}</span>
      </div>
    `).join('');
  });
}

// Quick capture from manual URL
btnUpload.addEventListener('click', async () => {
  const url = manualUrl.value.trim();
  if (!url) return showToast('Enter an image URL', 'error');

  btnUpload.disabled = true;
  try {
    chrome.runtime.sendMessage({
      type: 'capture-local',
      imageUrl: url,
      metadata: { sourceUrl: '', pageTitle: '', tags: [] },
    }, (response) => {
      if (response?.success) {
        showToast('Image uploaded!', 'success');
        manualUrl.value = '';
        loadRecent();
      } else {
        showToast(response?.error || 'Upload failed', 'error');
      }
      btnUpload.disabled = false;
    });
  } catch (err) {
    showToast(err.message, 'error');
    btnUpload.disabled = false;
  }
});

btnFetch.addEventListener('click', async () => {
  const url = manualUrl.value.trim();
  if (!url) return showToast('Enter an image URL', 'error');

  btnFetch.disabled = true;
  try {
    chrome.runtime.sendMessage({
      type: 'capture-remote',
      imageUrl: url,
      metadata: { sourceUrl: '', pageTitle: '', tags: [] },
    }, (response) => {
      if (response?.success) {
        showToast('Image fetched by server!', 'success');
        manualUrl.value = '';
        loadRecent();
      } else {
        showToast(response?.error || 'Fetch failed', 'error');
      }
      btnFetch.disabled = false;
    });
  } catch (err) {
    showToast(err.message, 'error');
    btnFetch.disabled = false;
  }
});

// Navigation
btnSettings.addEventListener('click', () => {
  viewMain.classList.add('hidden');
  viewSettings.classList.remove('hidden');
});

btnBack.addEventListener('click', () => {
  viewSettings.classList.add('hidden');
  viewMain.classList.remove('hidden');
});

btnGallery.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/gallery/gallery.html') });
});

// Save settings
btnSaveSettings.addEventListener('click', async () => {
  const settings = {
    workerUrl: settingWorkerUrl.value.trim(),
    apiToken: settingApiToken.value.trim(),
    defaultMode: settingDefaultMode.value,
  };

  await saveSettings(settings);
  showToast('Settings saved!', 'success');

  // Re-check connection
  if (settings.workerUrl && settings.apiToken) {
    try {
      await apiRequest('/api/health');
      statusDot.className = 'status-dot connected';
      statusDot.title = 'Connected';
    } catch {
      statusDot.className = 'status-dot error';
      statusDot.title = 'Connection failed';
    }
  }
});

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
