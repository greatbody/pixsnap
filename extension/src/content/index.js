// PixSnap - Content Script
// Shows capture buttons when hovering over images

(function () {
  'use strict';

  let toolbar = null;
  let currentTarget = null;
  let hideTimer = null;
  let trackingFrame = null;

  const MIN_SIZE = 60;

  function createToolbar() {
    const el = document.createElement('div');
    el.className = 'pixsnap-toolbar';
    el.innerHTML = `
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
    `;
    document.body.appendChild(el);

    el.querySelector('.pixsnap-btn-upload').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      captureImage('capture-local');
    });

    el.querySelector('.pixsnap-btn-fetch').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      captureImage('capture-remote');
    });

    // Keep toolbar visible while mouse is on it
    el.addEventListener('mouseenter', () => {
      cancelHide();
    });

    el.addEventListener('mouseleave', () => {
      scheduleHide();
    });

    return el;
  }

  /**
   * Position the toolbar at the top-right corner of the image,
   * using fixed positioning (viewport coordinates) so scrolling
   * doesn't leave it stranded.
   */
  function positionToolbar(img) {
    const rect = img.getBoundingClientRect();

    // Clamp to viewport
    const top = Math.max(4, rect.top + 4);
    const right = Math.max(4, window.innerWidth - rect.right + 4);

    toolbar.style.top = `${top}px`;
    toolbar.style.right = `${right}px`;
    toolbar.style.left = '';
  }

  function showToolbar(img) {
    if (!toolbar) {
      toolbar = createToolbar();
    }

    const rect = img.getBoundingClientRect();
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;

    // If image is not visible in viewport at all, don't show
    if (rect.bottom < 0 || rect.top > window.innerHeight ||
        rect.right < 0 || rect.left > window.innerWidth) return;

    currentTarget = img;
    cancelHide();
    positionToolbar(img);
    toolbar.classList.add('pixsnap-visible');

    // Start tracking position (handles scroll & resize smoothly)
    startTracking();
  }

  function hideToolbar() {
    if (toolbar) {
      toolbar.classList.remove('pixsnap-visible');
    }
    currentTarget = null;
    stopTracking();
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hideToolbar, 200);
  }

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  /**
   * Use requestAnimationFrame to keep the toolbar pinned
   * to the image as the page scrolls or resizes.
   * This is much smoother than scroll event listeners.
   */
  function startTracking() {
    stopTracking();
    function track() {
      if (!currentTarget) return;

      const rect = currentTarget.getBoundingClientRect();

      // If image scrolled out of view, hide toolbar
      if (rect.bottom < 0 || rect.top > window.innerHeight ||
          rect.right < 0 || rect.left > window.innerWidth) {
        hideToolbar();
        return;
      }

      positionToolbar(currentTarget);
      trackingFrame = requestAnimationFrame(track);
    }
    trackingFrame = requestAnimationFrame(track);
  }

  function stopTracking() {
    if (trackingFrame) {
      cancelAnimationFrame(trackingFrame);
      trackingFrame = null;
    }
  }

  function captureImage(type) {
    if (!currentTarget) return;

    const imageUrl = currentTarget.src || currentTarget.currentSrc;
    if (!imageUrl) return;

    const mode = type === 'capture-local' ? 'uploading' : 'fetching';
    showToast('info', `Capturing... ${mode} image`);

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
        showToast('success', 'Image captured successfully');
      } else {
        showToast('error', `Capture failed: ${response?.error || 'Unknown error'}`);
      }
    });

    hideToolbar();
  }

  // ====== Toast notification system ======

  let toastContainer = null;

  const TOAST_ICONS = {
    info: `<svg class="pixsnap-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    success: `<svg class="pixsnap-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="pixsnap-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'pixsnap-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(type, message) {
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `pixsnap-toast pixsnap-toast-${type}`;
    toast.innerHTML = `${TOAST_ICONS[type] || ''}<span class="pixsnap-toast-text">${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.add('pixsnap-toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ====== Event handling ======

  // Track the image under the mouse pointer.
  // We use mouseover on document and check if target is an <img>.
  document.addEventListener('mouseover', (e) => {
    const img = e.target.closest('img');
    if (img && img.src) {
      // Don't re-trigger if already showing for this image
      if (currentTarget === img) {
        cancelHide();
        return;
      }
      showToolbar(img);
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    const img = e.target.closest('img');
    if (!img) return;

    // If mouse moved to the toolbar, don't hide
    if (toolbar && toolbar.contains(e.relatedTarget)) {
      cancelHide();
      return;
    }

    // If mouse moved to another part of the same image, don't hide
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('img') === img) {
      return;
    }

    scheduleHide();
  }, true);
})();
