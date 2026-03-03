import { state, addEvent, resetForm, setEvents, setCurrentUser } from './state.js';
import { showToast } from './toast.js';
import { loginOrRegister, upsertEvent, upsertUserEventLink, fetchUserEvents } from './supabase.js';
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
const ACTIVE_PAGE_KEY = 'reminderActivePage';
const FORCE_REFRESH_ASSETS = [
  'css/styles.css',
  'js/main.js',
  'js/app.js',
  'js/ui.js',
  'js/state.js',
  'js/utils.js',
  'js/toast.js',
  'js/supabase.js',
  'js/config.js'
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
    localStorage.setItem(ACTIVE_PAGE_KEY, 'schedule');
    switchToAddPage();
  });

  document.getElementById('navSchedule').addEventListener('click', () => {
    localStorage.setItem(ACTIVE_PAGE_KEY, 'schedule');
    switchToMainPage();
  });

  document.getElementById('navMe').addEventListener('click', () => {
    localStorage.setItem(ACTIVE_PAGE_KEY, 'me');
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

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLoginCardClick);
  }

  const loginCancelBtn = document.getElementById('loginCancelBtn');
  if (loginCancelBtn) {
    loginCancelBtn.addEventListener('click', closeLoginModal);
  }

  const loginConfirmBtn = document.getElementById('loginConfirmBtn');
  if (loginConfirmBtn) {
    loginConfirmBtn.addEventListener('click', () => {
      void handleLogin();
    });
  }

  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target.id === 'loginModal') {
        closeLoginModal();
      }
    });
  }

  const accountActionModal = document.getElementById('accountActionModal');
  if (accountActionModal) {
    accountActionModal.addEventListener('click', (e) => {
      if (e.target.id === 'accountActionModal') {
        closeAccountActionModal();
      }
    });
  }

  const accountActionCancelBtn = document.getElementById('accountActionCancelBtn');
  if (accountActionCancelBtn) {
    accountActionCancelBtn.addEventListener('click', closeAccountActionModal);
  }

  const switchAccountBtn = document.getElementById('switchAccountBtn');
  if (switchAccountBtn) {
    switchAccountBtn.addEventListener('click', () => {
      closeAccountActionModal();
      openLoginModal();
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const loginUserPassport = document.getElementById('loginUserPassport');
  if (loginUserPassport) {
    loginUserPassport.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        void handleLogin();
      }
    });
  }
}

async function handleSaveEvent() {
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
  if (state.currentUser?.user_name) {
    try {
      await uploadEventToCloud(event, state.currentUser.user_name);
      await pullEventsFromCloud(state.currentUser.user_name);
      showToast('事件已保存并同步云端', 'success');
    } catch (error) {
      console.error(error);
      showToast('本地已保存，云端同步失败', 'error');
    }
  } else {
    showToast('事件已保存到本地，请先登录同步云端', 'info');
  }
  
  resetForm();
  resetFormUI();
  localStorage.setItem(ACTIVE_PAGE_KEY, 'schedule');
  switchToMainPage();
  renderCountdownList();
}

async function handleLogin() {
  const userNameInput = document.getElementById('loginUserName');
  const userPassportInput = document.getElementById('loginUserPassport');
  const userName = userNameInput?.value?.trim();
  const userPassport = userPassportInput?.value?.trim();

  if (!userName) {
    showToast('用户名不能为空', 'error');
    return;
  }
  if (!userPassport) {
    showToast('口令不能为空', 'error');
    return;
  }

  const loginConfirmBtn = document.getElementById('loginConfirmBtn');
  if (loginConfirmBtn) {
    loginConfirmBtn.disabled = true;
    loginConfirmBtn.textContent = '登录中...';
  }

  try {
    const user = await loginOrRegister(userName, userPassport);
    setCurrentUser(user);
    updateLoginStatus();
    await pullEventsFromCloud(user.user_name);
    closeLoginModal();
    showToast('登录成功，云端事件已加载', 'success');
  } catch (error) {
    console.error(error);
    showToast(error.message || '登录失败', 'error');
  } finally {
    if (loginConfirmBtn) {
      loginConfirmBtn.disabled = false;
      loginConfirmBtn.textContent = '登录';
    }
  }
}

function handleLoginCardClick() {
  if (state.currentUser?.user_name) {
    openAccountActionModal();
  } else {
    openLoginModal();
  }
}

function openLoginModal() {
  const modal = document.getElementById('loginModal');
  const userNameInput = document.getElementById('loginUserName');
  const userPassportInput = document.getElementById('loginUserPassport');
  if (!modal) return;
  modal.classList.add('active');
  if (userNameInput) {
    userNameInput.value = state.currentUser?.user_name || '';
  }
  if (userPassportInput) {
    userPassportInput.value = '';
  }
  if (userNameInput && !userNameInput.value) {
    userNameInput.focus();
  } else if (userPassportInput) {
    userPassportInput.focus();
  }
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.remove('active');
}

function openAccountActionModal() {
  const modal = document.getElementById('accountActionModal');
  const title = document.getElementById('accountActionTitle');
  if (title) {
    title.textContent = `${state.currentUser?.user_name || ''}`;
  }
  if (modal) {
    modal.classList.add('active');
  }
}

function closeAccountActionModal() {
  const modal = document.getElementById('accountActionModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function handleLogout() {
  closeAccountActionModal();
  setCurrentUser(null);
  updateLoginStatus();
  showToast('已注销', 'info');
}

function formatSolarDateCompact(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function getLunarDateText(date) {
  const lunar = Lunar.fromDate(date);
  return `${lunar.getYearInGanZhi()}${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}

function toDbEventRow(event) {
  const date = new Date(event.targetDate);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return {
    event_name: event.name,
    solar_date: formatSolarDateCompact(date),
    lunar_date: getLunarDateText(date),
    weekday: weekdays[date.getDay()],
    repeat_type: event.repeatType,
    is_include_begin_day: !!event.includeStartDay,
  };
}

function fromDbEventRow(row) {
  const solar = String(row.solar_date || '');
  const year = Number(solar.slice(0, 4));
  const month = Number(solar.slice(4, 6));
  const day = Number(solar.slice(6, 8));
  const date = new Date(year, month - 1, day);
  const isValidDate = Number.isFinite(date.getTime());
  if (!isValidDate) {
    throw new Error(`无效的 solar_date: ${solar}`);
  }

  return {
    id: `${row.event_name}-${solar}`,
    name: row.event_name,
    targetDate: date.toISOString(),
    calendarType: 'solar',
    includeStartDay: !!row.is_include_begin_day,
    repeatType: row.repeat_type,
    createdAt: new Date().toISOString(),
  };
}

async function uploadEventToCloud(event, userName) {
  const dbEvent = toDbEventRow(event);
  await upsertEvent(dbEvent);
  await upsertUserEventLink(userName, dbEvent.event_name);
}

async function pullEventsFromCloud(userName) {
  const rows = await fetchUserEvents(userName);
  const normalizedRows = rows.flatMap((item) => {
    if (!item || !item.reminder_events) return [];
    return Array.isArray(item.reminder_events) ? item.reminder_events : [item.reminder_events];
  });
  const events = normalizedRows
    .map((row) => {
      try {
        return fromDbEventRow(row);
      } catch (error) {
        console.error('解析云端事件失败:', row, error);
        return null;
      }
    })
    .filter(Boolean);
  setEvents(events);
  renderCountdownList();
}

function updateLoginStatus() {
  const loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return;
  const title = loginBtn.querySelector('.settings-card-title');
  if (!title) return;
  if (state.currentUser?.user_name) {
    title.textContent = `${state.currentUser.user_name}`;
  } else {
    title.textContent = '登录';
  }
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
    localStorage.setItem(ACTIVE_PAGE_KEY, 'me');
    window.setTimeout(() => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set(RELOAD_PARAM, stamp);
      window.location.replace(nextUrl.toString());
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
  updateLoginStatus();
  renderCountdownList();
  const page = localStorage.getItem(ACTIVE_PAGE_KEY);
  if (page === 'me') {
    switchToMyPage();
  } else {
    switchToMainPage();
  }
  if (state.currentUser?.user_name) {
    void pullEventsFromCloud(state.currentUser.user_name).catch((error) => {
      console.error(error);
      showToast('云端事件加载失败，已回退本地数据', 'error');
    });
  }
}

export default { init };
