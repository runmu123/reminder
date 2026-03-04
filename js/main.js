import { init } from './app.js';

function enableKeyboardOverlayMode() {
  const virtualKeyboard = navigator.virtualKeyboard;
  if (!virtualKeyboard || typeof virtualKeyboard !== 'object') {
    return;
  }
  try {
    virtualKeyboard.overlaysContent = true;
  } catch (_) {
    // 部分 WebView 只读或不允许设置，忽略即可
  }
}

function isEditableElement(element) {
  if (!element || element.nodeType !== 1) {
    return false;
  }

  const tagName = element.tagName;
  if (tagName === 'TEXTAREA') {
    return !element.readOnly && !element.disabled;
  }

  if (tagName === 'INPUT') {
    const type = (element.type || 'text').toLowerCase();
    if (['button', 'checkbox', 'radio', 'range', 'file', 'color', 'submit', 'reset'].includes(type)) {
      return false;
    }
    return !element.readOnly && !element.disabled;
  }

  return element.isContentEditable === true;
}

function setupKeyboardNavGuard() {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const keyboardThreshold = 120;
  let baselineInnerHeight = window.innerHeight;
  let keyboardVisible = false;

  const setKeyboardVisible = (visible) => {
    if (keyboardVisible === visible) {
      return;
    }
    keyboardVisible = visible;
    root.classList.toggle('keyboard-open', visible);
  };

  const inferKeyboardVisible = () => {
    const activeEditable = isEditableElement(document.activeElement);
    const heightDrop = baselineInnerHeight - window.innerHeight;
    if (heightDrop > keyboardThreshold) {
      return true;
    }
    return activeEditable;
  };

  document.addEventListener('focusin', (event) => {
    if (isEditableElement(event.target)) {
      setKeyboardVisible(true);
    }
  }, true);

  document.addEventListener('focusout', () => {
    // 等待下一个焦点稳定，避免输入框切换时闪动
    setTimeout(() => {
      setKeyboardVisible(inferKeyboardVisible());
    }, 40);
  }, true);

  window.addEventListener('resize', () => {
    if (!keyboardVisible && window.innerHeight > baselineInnerHeight) {
      baselineInnerHeight = window.innerHeight;
    }
    setKeyboardVisible(inferKeyboardVisible());
  });

  const viewport = window.visualViewport;
  if (!viewport) {
    return;
  }

  const updateByViewport = () => {
    const activeEditable = isEditableElement(document.activeElement);
    const delta = window.innerHeight - viewport.height;

    if (delta > keyboardThreshold) {
      setKeyboardVisible(true);
      return;
    }

    if (!activeEditable) {
      setKeyboardVisible(false);
    }
  };

  viewport.addEventListener('resize', updateByViewport);
  viewport.addEventListener('scroll', updateByViewport);
}

document.addEventListener('DOMContentLoaded', () => {
  enableKeyboardOverlayMode();
  setupKeyboardNavGuard();
  init();
});
