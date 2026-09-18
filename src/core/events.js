/**
 * PAPER MAX - Lightweight Core Event Bus
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for event "${event}":`, err);
      }
    });
  }
}

export const bus = new EventBus();

let currentDismissHandler = null;

/**
 * Toast / Snackbar Notification Dispatcher
 * Centralized in core/events. Implements iOS Spring Animation, Liquid Glass + NEON border UI.
 * Dismisses only when the user clicks anywhere on the screen.
 */
export function showToast(message, typeOrIcon = '✓') {
  if (typeof document === 'undefined') return;
  const toast = document.getElementById('system-toast');
  if (!toast) return;

  // Resolve icon/emoji based on parameter or keywords
  let icon = '✨';
  if (typeOrIcon === 'success' || typeOrIcon === '✓' || typeOrIcon === '✅') {
    icon = '✓';
  } else if (typeOrIcon === 'error' || typeOrIcon === 'erro' || typeOrIcon === '❌') {
    icon = '✕';
  } else if (typeOrIcon === 'warning' || typeOrIcon === 'alerta' || typeOrIcon === '⚠️' || typeOrIcon === '⚠') {
    icon = '⚠';
  } else if (typeOrIcon === 'info' || typeOrIcon === 'ℹ️' || typeOrIcon === 'ℹ') {
    icon = 'ℹ';
  } else if (typeof typeOrIcon === 'string' && typeOrIcon.trim()) {
    icon = typeOrIcon;
  }

  const iconEl = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-message') || document.getElementById('toast-text');

  if (iconEl) iconEl.textContent = icon;
  if (msgEl) {
    msgEl.textContent = message;
  } else {
    toast.innerHTML = `
      <div class="snackbar-content">
        <div class="snackbar-icon-pill">
          <span id="toast-icon">${icon}</span>
        </div>
        <div class="snackbar-body">
          <span id="toast-message" class="snackbar-message">${message}</span>
        </div>
      </div>
      <button type="button" class="snackbar-close-btn" id="toast-close-btn" aria-label="Fechar notificação">✕</button>
    `;
  }

  // Remove previous dismiss listener if active
  if (currentDismissHandler) {
    document.removeEventListener('click', currentDismissHandler, true);
    document.removeEventListener('touchstart', currentDismissHandler, true);
    currentDismissHandler = null;
  }

  // Show Snackbar with iOS Spring Animation
  toast.classList.remove('show');
  void toast.offsetWidth; // Trigger reflow for spring restart
  toast.classList.add('show');

  // Register screen-wide dismiss on NEXT user interaction
  setTimeout(() => {
    currentDismissHandler = (event) => {
      toast.classList.remove('show');
      if (currentDismissHandler) {
        document.removeEventListener('click', currentDismissHandler, true);
        document.removeEventListener('touchstart', currentDismissHandler, true);
        currentDismissHandler = null;
      }
    };

    document.addEventListener('click', currentDismissHandler, true);
    document.addEventListener('touchstart', currentDismissHandler, { capture: true, passive: true });
  }, 80);

  // Close button direct handler
  const closeBtn = document.getElementById('toast-close-btn');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      toast.classList.remove('show');
      if (currentDismissHandler) {
        document.removeEventListener('click', currentDismissHandler, true);
        document.removeEventListener('touchstart', currentDismissHandler, true);
        currentDismissHandler = null;
      }
    };
  }
}
