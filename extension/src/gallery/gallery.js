// PixSnap - Gallery Page Script
import { apiRequest, formatSize, formatDate } from '../utils/api.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// State
const state = {
  images: [],
  tags: [],
  page: 1,
  limit: 40,
  hasMore: true,
  loading: false,
  search: '',
  activeTag: null,
  viewMode: 'grid', // 'grid' | 'list'
  selectMode: false,
  selected: new Set(),
  currentDetailIndex: -1,
};

// Elements
const imageContainer = $('#image-container');
const imageCount = $('#image-count');
const searchInput = $('#search-input');
const tagList = $('#tag-list');
const loading = $('#loading');
const emptyState = $('#empty-state');
const bulkBar = $('#bulk-bar');
const selectedCount = $('#selected-count');
const lightbox = $('#lightbox');
const mainEl = $('#main');

// ====== Initialization ======

async function init() {
  bindEvents();
  await Promise.all([loadImages(), loadTags()]);
}

function bindEvents() {
  // Search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = searchInput.value.trim();
      resetAndLoad();
    }, 300);
  });

  // View toggle
  $('#btn-grid-view').addEventListener('click', () => setViewMode('grid'));
  $('#btn-list-view').addEventListener('click', () => setViewMode('list'));

  // Select mode
  $('#btn-select-mode').addEventListener('click', toggleSelectMode);
  $('#btn-cancel-select').addEventListener('click', toggleSelectMode);

  // Bulk actions
  $('#btn-bulk-tag').addEventListener('click', showTagDialog);
  $('#btn-bulk-delete').addEventListener('click', showDeleteDialog);

  // Tag dialog
  $('#btn-confirm-tag').addEventListener('click', applyBulkTag);
  $('#btn-cancel-tag').addEventListener('click', () => $('#tag-dialog').classList.add('hidden'));

  // Delete dialog
  $('#btn-confirm-delete').addEventListener('click', confirmDelete);
  $('#btn-cancel-delete').addEventListener('click', () => $('#delete-dialog').classList.add('hidden'));

  // Lightbox
  $('#lightbox-close').addEventListener('click', closeLightbox);
  $('#lightbox-backdrop').addEventListener('click', closeLightbox);
  $('#lightbox-prev').addEventListener('click', () => navigateDetail(-1));
  $('#lightbox-next').addEventListener('click', () => navigateDetail(1));
  $('#btn-add-tag').addEventListener('click', addTagToDetail);
  $('#detail-tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTagToDetail();
  });
  $('#btn-delete-single').addEventListener('click', deleteSingleImage);

  // Keyboard
  document.addEventListener('keydown', handleKeyboard);

  // Infinite scroll
  window.addEventListener('scroll', handleScroll, { passive: true });
}

// ====== Data Loading ======

async function loadImages(append = false) {
  if (state.loading) return;
  state.loading = true;
  loading.classList.remove('hidden');

  try {
    const params = new URLSearchParams({
      page: state.page.toString(),
      limit: state.limit.toString(),
    });
    if (state.search) params.set('search', state.search);
    if (state.activeTag) params.set('tag', state.activeTag);

    const data = await apiRequest(`/api/images?${params}`);

    if (append) {
      state.images.push(...data.images);
    } else {
      state.images = data.images;
    }

    state.hasMore = data.images.length === state.limit;
    renderImages(append);
    updateImageCount(data.total || state.images.length);
  } catch (err) {
    console.error('[PixSnap] Failed to load images:', err);
    if (!append && state.images.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.querySelector('p').textContent = `Error: ${err.message}`;
    }
  } finally {
    state.loading = false;
    loading.classList.add('hidden');
  }
}

async function loadTags() {
  try {
    const data = await apiRequest('/api/tags');
    state.tags = data.tags || [];
    renderTags();
  } catch (err) {
    console.error('[PixSnap] Failed to load tags:', err);
  }
}

function resetAndLoad() {
  state.page = 1;
  state.hasMore = true;
  state.images = [];
  imageContainer.innerHTML = '';
  loadImages();
}

// ====== Rendering ======

function renderImages(append = false) {
  if (!append) {
    imageContainer.innerHTML = '';
  }

  if (state.images.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  const startIdx = append ? state.images.length - (state.images.length - imageContainer.children.length) : 0;
  const fragment = document.createDocumentFragment();

  for (let i = startIdx; i < state.images.length; i++) {
    const img = state.images[i];
    const card = createImageCard(img, i);
    fragment.appendChild(card);
  }

  imageContainer.appendChild(fragment);
}

function createImageCard(img, index) {
  const card = document.createElement('div');
  card.className = `image-card${state.selected.has(img.id) ? ' selected' : ''}`;
  card.dataset.id = img.id;
  card.dataset.index = index;

  const thumbUrl = getImageUrl(img.id);

  card.innerHTML = `
    <div class="checkbox">${state.selected.has(img.id) ? '&#10003;' : ''}</div>
    <img class="thumb" src="${thumbUrl}" alt="${escapeHtml(img.filename)}" loading="lazy">
    <div class="card-info">
      <div class="card-title">${escapeHtml(img.filename)}</div>
      <div class="card-meta">${formatSize(img.size)} &middot; ${formatDate(img.created_at)}</div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (state.selectMode) {
      toggleSelection(img.id, card);
    } else {
      openLightbox(index);
    }
  });

  return card;
}

function renderTags() {
  const allItem = document.createElement('div');
  allItem.className = `tag-item${state.activeTag === null ? ' active' : ''}`;
  allItem.innerHTML = `<span>All Images</span>`;
  allItem.addEventListener('click', () => {
    state.activeTag = null;
    resetAndLoad();
    renderTags();
  });

  tagList.innerHTML = '';
  tagList.appendChild(allItem);

  for (const tag of state.tags) {
    const item = document.createElement('div');
    item.className = `tag-item${state.activeTag === tag.name ? ' active' : ''}`;
    item.innerHTML = `
      <span>${escapeHtml(tag.name)}</span>
      <span class="count">${tag.count}</span>
    `;
    item.addEventListener('click', () => {
      state.activeTag = tag.name;
      resetAndLoad();
      renderTags();
    });
    tagList.appendChild(item);
  }
}

function updateImageCount(total) {
  imageCount.textContent = `${total} image${total !== 1 ? 's' : ''}`;
}

// ====== View Mode ======

function setViewMode(mode) {
  state.viewMode = mode;
  if (mode === 'list') {
    imageContainer.classList.add('list-view');
  } else {
    imageContainer.classList.remove('list-view');
  }
  $('#btn-grid-view').classList.toggle('active', mode === 'grid');
  $('#btn-list-view').classList.toggle('active', mode === 'list');
}

// ====== Selection ======

function toggleSelectMode() {
  state.selectMode = !state.selectMode;
  state.selected.clear();

  mainEl.classList.toggle('select-mode', state.selectMode);
  $('#btn-select-mode').classList.toggle('active', state.selectMode);
  bulkBar.classList.toggle('hidden', !state.selectMode);
  updateSelectedCount();

  // Remove selection styling from all cards
  imageContainer.querySelectorAll('.image-card').forEach(card => {
    card.classList.remove('selected');
    card.querySelector('.checkbox').innerHTML = '';
  });
}

function toggleSelection(id, card) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
    card.classList.remove('selected');
    card.querySelector('.checkbox').innerHTML = '';
  } else {
    state.selected.add(id);
    card.classList.add('selected');
    card.querySelector('.checkbox').innerHTML = '&#10003;';
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  selectedCount.textContent = `${state.selected.size} selected`;
}

// ====== Lightbox ======

function openLightbox(index) {
  state.currentDetailIndex = index;
  const img = state.images[index];
  if (!img) return;

  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  updateLightboxContent(img);
}

function closeLightbox() {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
  state.currentDetailIndex = -1;
}

function navigateDetail(direction) {
  const newIndex = state.currentDetailIndex + direction;
  if (newIndex < 0 || newIndex >= state.images.length) return;
  openLightbox(newIndex);
}

function updateLightboxContent(img) {
  const imageUrl = getImageUrl(img.id);
  $('#lightbox-image').src = imageUrl;
  $('#detail-filename').textContent = img.filename || 'untitled';
  $('#detail-size').textContent = formatSize(img.size);
  $('#detail-dimensions').textContent = img.width && img.height ? `${img.width} x ${img.height}` : 'Unknown';
  $('#detail-type').textContent = img.content_type || 'Unknown';
  $('#detail-mode').textContent = img.capture_mode === 'remote' ? 'Server fetch' : 'Local upload';
  $('#detail-date').textContent = formatDate(img.created_at);

  const sourceLink = $('#detail-source');
  if (img.source_url) {
    sourceLink.href = img.source_url;
    sourceLink.textContent = new URL(img.source_url).hostname;
    sourceLink.parentElement.style.display = '';
  } else {
    sourceLink.parentElement.style.display = 'none';
  }

  // Tags
  const tags = parseTags(img.tags);
  renderDetailTags(tags);

  // Download link
  const downloadBtn = $('#btn-download');
  downloadBtn.href = imageUrl;
  downloadBtn.download = img.filename || 'image';
}

function renderDetailTags(tags) {
  const container = $('#detail-tag-list');
  container.innerHTML = tags.map(tag => `
    <span class="tag-chip">
      ${escapeHtml(tag)}
      <button class="remove-tag" data-tag="${escapeHtml(tag)}">&times;</button>
    </span>
  `).join('');

  container.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tagName = btn.dataset.tag;
      await removeTagFromImage(state.images[state.currentDetailIndex].id, tagName);
    });
  });
}

// ====== Tag Operations ======

async function addTagToDetail() {
  const input = $('#detail-tag-input');
  const tagName = input.value.trim();
  if (!tagName) return;

  const img = state.images[state.currentDetailIndex];
  if (!img) return;

  const tags = parseTags(img.tags);
  if (tags.includes(tagName)) {
    input.value = '';
    return;
  }

  tags.push(tagName);

  try {
    await apiRequest(`/api/images/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });

    img.tags = JSON.stringify(tags);
    renderDetailTags(tags);
    input.value = '';
    loadTags(); // Refresh tag list
  } catch (err) {
    console.error('[PixSnap] Failed to add tag:', err);
  }
}

async function removeTagFromImage(imageId, tagName) {
  const img = state.images.find(i => i.id === imageId);
  if (!img) return;

  const tags = parseTags(img.tags).filter(t => t !== tagName);

  try {
    await apiRequest(`/api/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });

    img.tags = JSON.stringify(tags);
    renderDetailTags(tags);
    loadTags();
  } catch (err) {
    console.error('[PixSnap] Failed to remove tag:', err);
  }
}

function showTagDialog() {
  if (state.selected.size === 0) return;
  $('#bulk-tag-input').value = '';
  $('#tag-dialog').classList.remove('hidden');
  $('#bulk-tag-input').focus();
}

async function applyBulkTag() {
  const input = $('#bulk-tag-input');
  const newTags = input.value.split(',').map(t => t.trim()).filter(Boolean);
  if (newTags.length === 0) return;

  const promises = [...state.selected].map(async (id) => {
    const img = state.images.find(i => i.id === id);
    if (!img) return;
    const existing = parseTags(img.tags);
    const merged = [...new Set([...existing, ...newTags])];
    await apiRequest(`/api/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: merged }),
    });
    img.tags = JSON.stringify(merged);
  });

  try {
    await Promise.all(promises);
    $('#tag-dialog').classList.add('hidden');
    loadTags();
  } catch (err) {
    console.error('[PixSnap] Bulk tag failed:', err);
  }
}

// ====== Delete ======

function showDeleteDialog() {
  if (state.selected.size === 0) return;
  $('#delete-message').textContent = `Are you sure you want to delete ${state.selected.size} image(s)? This cannot be undone.`;
  $('#delete-dialog').classList.remove('hidden');
}

async function confirmDelete() {
  const ids = [...state.selected];

  try {
    await Promise.all(ids.map(id =>
      apiRequest(`/api/images/${id}`, { method: 'DELETE' })
    ));

    state.images = state.images.filter(img => !ids.includes(img.id));
    state.selected.clear();
    renderImages();
    updateSelectedCount();
    loadTags();
  } catch (err) {
    console.error('[PixSnap] Delete failed:', err);
  }

  $('#delete-dialog').classList.add('hidden');
}

async function deleteSingleImage() {
  const img = state.images[state.currentDetailIndex];
  if (!img) return;

  if (!confirm('Delete this image?')) return;

  try {
    await apiRequest(`/api/images/${img.id}`, { method: 'DELETE' });
    state.images.splice(state.currentDetailIndex, 1);
    closeLightbox();
    renderImages();
    loadTags();
  } catch (err) {
    console.error('[PixSnap] Delete failed:', err);
  }
}

// ====== Keyboard ======

function handleKeyboard(e) {
  if (lightbox.classList.contains('hidden')) return;

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      navigateDetail(-1);
      break;
    case 'ArrowRight':
      navigateDetail(1);
      break;
  }
}

// ====== Infinite Scroll ======

function handleScroll() {
  if (state.loading || !state.hasMore) return;

  const scrollBottom = window.innerHeight + window.scrollY;
  const docHeight = document.documentElement.scrollHeight;

  if (docHeight - scrollBottom < 400) {
    state.page++;
    loadImages(true);
  }
}

// ====== Helpers ======

function getImageUrl(id) {
  // Construct the image file URL from settings
  const workerUrl = settingsCache?.workerUrl || '';
  const token = settingsCache?.apiToken || '';
  if (!workerUrl) return '';
  return `${workerUrl.replace(/\/+$/, '')}/api/images/${id}/file`;
}

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Cache settings for URL construction
let settingsCache = null;
async function loadSettings() {
  const defaults = { workerUrl: '', apiToken: '', defaultMode: 'local' };
  settingsCache = await chrome.storage.sync.get(defaults);
}

// Boot
loadSettings().then(init);
