import { state, addEvent, resetForm } from './state.js';
import { showToast } from './toast.js';
import { 
  renderClock, 
  renderDate, 
  renderCountdownList, 
  renderTargetDate,
  updateCalendarToggle,
  switchToAddPage,
  switchToMainPage,
  switchToMyPage,
  openDatePicker,
  closeDatePicker,
  updateRepeatButton,
  resetFormUI,
  showRefreshOverlay,
  updateRefreshProgress,
  hideRefreshOverlay
} from './ui.js';

const REPEAT_OPTIONS = ['不重复', '每周', '每月', '每年'];
const FORCE_REFRESH_ASSETS = [
  'js/main.js',
  'js/app.js',
  'js/ui.js',
  'js/state.js',
  'js/utils.js',
  'js/toast.js'
];
const RELOAD_PARAM = '__reload';

export function initClock() {
  renderDate();
  renderClock();
  state.timerId = setInterval(() => {
    renderClock();
    renderDate();
    renderCountdownList();
  }, 1000);
}

export function destroyClock() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

export function initEventListeners() {
  document.querySelector('.add-btn').addEventListener('click', () => {
    switchToAddPage();
  });

  document.getElementById('navSchedule').addEventListener('click', () => {
    switchToMainPage();
  });

  document.getElementById('navMe').addEventListener('click', () => {
    switchToMyPage();
  });

  document.getElementById('navTodo').addEventListener('click', () => {
    showToast('待办功能开发中', 'info');
  });

  document.getElementById('navApps').addEventListener('click', () => {
    showToast('应用功能开发中', 'info');
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    switchToMainPage();
  });

  document.getElementById('targetDateDisplay').addEventListener('click', () => {
    openDatePicker();
  });

  document.querySelectorAll('.calendar-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedCalendarType = btn.dataset.type;
      updateCalendarToggle();
      renderTargetDate();
    });
  });

  document.getElementById('repeatType').addEventListener('click', () => {
    state.currentRepeatIndex = (state.currentRepeatIndex + 1) % REPEAT_OPTIONS.length;
    updateRepeatButton();
  });

  document.getElementById('advancedToggle').addEventListener('click', () => {
    document.getElementById('advancedContent').classList.toggle('active');
  });

  document.getElementById('saveBtn').addEventListener('click', handleSaveEvent);

  document.getElementById('datePickerCancel').addEventListener('click', () => {
    closeDatePicker();
  });

  document.getElementById('datePickerConfirm').addEventListener('click', () => {
    renderTargetDate();
    closeDatePicker();
  });

  document.getElementById('datePickerModal').addEventListener('click', (e) => {
    if (e.target.id === 'datePickerModal') {
      closeDatePicker();
    }
  });

  const forceRefreshBtn = document.getElementById('forceRefreshCardBtn');
  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', () => {
      void handleForceRefresh();
    });
  }
}

function handleSaveEvent() {
  const eventName = document.getElementById('eventName').value.trim();
  const includeStartDay = document.getElementById('includeStartDay').checked;
  const repeatType = REPEAT_OPTIONS[state.currentRepeatIndex];

  if (!eventName) {
    showToast('请输入事件名称', 'error');
    return;
  }

  const event = {
    id: Date.now(),
    name: eventName,
    targetDate: state.selectedDate.toISOString(),
    calendarType: state.selectedCalendarType,
    includeStartDay,
    repeatType,
    createdAt: new Date().toISOString()
  };

  addEvent(event);
  showToast('事件已保存', 'success');
  
  resetForm();
  resetFormUI();
  switchToMainPage();
  renderCountdownList();
}

async function handleForceRefresh() {
  const trigger = document.getElementById('forceRefreshCardBtn');
  if (!trigger || trigger.disabled) return;

  trigger.disabled = true;
  trigger.classList.add('loading');
  showRefreshOverlay();
  updateRefreshProgress(5, '准备刷新资源...');

  try {
    const stamp = Date.now().toString();
    const total = FORCE_REFRESH_ASSETS.length;

    for (let i = 0; i < total; i++) {
      const asset = FORCE_REFRESH_ASSETS[i];
      const progress = Math.round(((i + 1) / total) * 85) + 10;
      updateRefreshProgress(progress, `刷新 ${asset} (${i + 1}/${total})`);
      const assetUrl = new URL(asset, window.location.href);
      assetUrl.searchParams.set(RELOAD_PARAM, stamp);
      const response = await fetch(assetUrl.toString(), { cache: 'reload' });
      if (!response.ok) {
        throw new Error(`资源刷新失败: ${asset}`);
      }
      await response.blob();
    }

    updateRefreshProgress(100, '刷新完成，正在重载...');
    showToast('资源已刷新，正在重载', 'success');
    window.setTimeout(() => {
      window.location.reload();
    }, 300);
  } catch (error) {
    console.error(error);
    hideRefreshOverlay();
    trigger.disabled = false;
    trigger.classList.remove('loading');
    showToast('强制刷新失败，请重试', 'error');
  }
}

export function init() {
  initClock();
  initEventListeners();
  renderCountdownList();
}

export default { init };
