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

/**
 * Toast Notification Dispatcher
 * Centralized in core/events to ensure modules can show notifications without circular dependencies.
 */
export function showToast(message, icon = '✓') {
  if (typeof document === 'undefined') return;
  const toast = document.getElementById('system-toast');
  const iconEl = document.getElementById('toast-icon');
  const textEl = document.getElementById('toast-text') || toast;

  if (iconEl) iconEl.textContent = icon;
  if (textEl && textEl !== toast) {
    textEl.textContent = message;
  } else if (toast) {
    toast.innerHTML = `<span id="toast-icon">${icon}</span> <span>${message}</span>`;
  }

  if (toast) {
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}
