// PixSnap - Content Script
// Adds a subtle overlay on hovered images for quick capture

(function () {
  'use strict';

  let overlay = null;
  let currentTarget = null;

  function createOverlay() {
    const el = document.createElement('div');
    el.className = 'pixsnap-overlay';
    el.innerHTML = `
      <div class="pixsnap-overlay-bar">
        <button class="pixsnap-btn pixsnap-btn-upload" title="Capture (upload)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <button class="pixsnap-btn pixsnap-btn-fetch" title="Capture (URL)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function showOverlay(img) {
    if (!overlay) {
      overlay = createOverlay();

      overlay.querySelector('.pixsnap-btn-upload').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        captureImage('capture-local');
      });

      overlay.querySelector('.pixsnap-btn-fetch').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        captureImage('capture-remote');
      });
    }

    const rect = img.getBoundingClientRect();

    // Only show overlay on images large enough to be meaningful
    if (rect.width < 60 || rect.height < 60) return;

    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.display = 'block';
    currentTarget = img;
  }

  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
    }
    currentTarget = null;
  }

  function captureImage(type) {
    if (!currentTarget) return;

    const imageUrl = currentTarget.src || currentTarget.currentSrc;
    if (!imageUrl) return;

    chrome.runtime.sendMessage({
      type: type,
      imageUrl: imageUrl,
      metadata: {
        sourceUrl: window.location.href,
        pageTitle: document.title,
        tags: [],
      },
    }, (response) => {
      if (response?.success) {
        flashSuccess();
      } else {
        console.warn('[PixSnap] Capture failed:', response?.error);
      }
    });

    hideOverlay();
  }

  function flashSuccess() {
    const flash = document.createElement('div');
    flash.className = 'pixsnap-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
  }

  // Throttled mousemove to detect image hover
  let hoverTimeout = null;
  document.addEventListener('mouseover', (e) => {
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      const img = e.target.closest('img');
      if (img && img.src) {
        showOverlay(img);
      }
    }, 200);
  });

  document.addEventListener('mouseout', (e) => {
    if (overlay && !overlay.contains(e.relatedTarget) && e.target.tagName === 'IMG') {
      setTimeout(() => {
        if (overlay && !overlay.matches(':hover')) {
          hideOverlay();
        }
      }, 300);
    }
  });

  // Hide overlay on scroll
  let scrollTimer = null;
  window.addEventListener('scroll', () => {
    if (overlay) overlay.style.display = 'none';
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (currentTarget) {
        showOverlay(currentTarget);
      }
    }, 150);
  }, { passive: true });
})();
