import { state, addEvent, resetForm, setEvents, setCurrentUser, saveEvents } from './state.js';
import { showToast } from './toast.js';
import { loginOrRegister, upsertEvent, upsertUserEventLink, fetchUserEvents, deleteUserEventLink, deleteEventByName } from './supabase.js';
import {
  renderClock,
  renderDate,
  renderCountdownList,
  getEventDisplayData,
  formatDateWithWeekday,
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
let lastCountdownDateKey = '';
let detailEventIndex = null;
let editingEventIndex = null;
let editingOriginalName = '';
let confirmResolver = null;
let detailSwipeIndex = 0;
let detailSwipeCardCount = 0;
let detailSwipeGoTo = null;

export function initClock() {
  renderDate();
  renderClock();
  const now = new Date();
  lastCountdownDateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  state.timerId = setInterval(() => {
    const current = new Date();
    const currentDateKey = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
    renderClock();
    renderDate();
    if (currentDateKey !== lastCountdownDateKey) {
      lastCountdownDateKey = currentDateKey;
      renderCountdownList();
    }
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
    void handleForceRefresh();
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
  document.getElementById('countdownList').addEventListener('click', handleCountdownItemClick);
  document.getElementById('detailBackBtn').addEventListener('click', closeDetailPage);
  document.getElementById('detailEditBtn').addEventListener('click', handleEditFromDetail);
  document.getElementById('detailDeleteBtn').addEventListener('click', () => {
    void handleDeleteFromDetail();
  });
  window.addEventListener('keydown', handleDetailKeydown);

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

  const confirmModal = document.getElementById('confirmModal');
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target.id === 'confirmModal') {
        closeConfirmModal(false);
      }
    });
  }

  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => closeConfirmModal(false));
  }

  const confirmOkBtn = document.getElementById('confirmOkBtn');
  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => closeConfirmModal(true));
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
    id: editingEventIndex !== null ? state.events[editingEventIndex].id : Date.now(),
    name: eventName,
    targetDate: state.selectedDate.toISOString(),
    calendarType: state.selectedCalendarType,
    includeStartDay,
    repeatType,
    createdAt: new Date().toISOString()
  };

  if (editingEventIndex !== null) {
    state.events[editingEventIndex] = event;
    saveEvents();
  } else {
    addEvent(event);
  }
  if (state.currentUser?.user_name) {
    try {
      if (editingEventIndex !== null && editingOriginalName && editingOriginalName !== event.name) {
        await removeEventFromCloud(editingOriginalName, state.currentUser.user_name);
      }
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
  editingEventIndex = null;
  editingOriginalName = '';
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

function handleCountdownItemClick(e) {
  const item = e.target.closest('.countdown-item[data-index]');
  if (!item) return;
  const index = Number(item.dataset.index);
  if (!Number.isInteger(index) || !state.events[index]) return;
  openDetailPage(index);
}

function openDetailPage(index) {
  detailEventIndex = index;
  renderDetailPage(state.events[index]);
  document.querySelector('.container')?.classList.add('detail-mode');
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('addEventPage').classList.remove('active');
  document.getElementById('myPage').classList.remove('active');
  document.getElementById('detailPage').classList.add('active');
}

function closeDetailPage() {
  detailEventIndex = null;
  detailSwipeCardCount = 0;
  detailSwipeGoTo = null;
  document.querySelector('.container')?.classList.remove('detail-mode');
  document.getElementById('detailPage').classList.remove('active');
  switchToMainPage();
}

function renderDetailPage(event) {
  const swiper = document.getElementById('detailSwiper');
  if (!swiper) return;
  const cards = buildDetailCards(event);
  swiper.innerHTML = cards.map(renderDetailCardHtml).join('');
  detailSwipeIndex = 0;
  swiper.scrollLeft = 0;
  bindDetailSwipe(cards.length);
}

function buildDetailCards(event) {
  const today = toDateOnly(new Date());
  const target = toDateOnly(new Date(event.targetDate));
  const display = getEventDisplayData(event, today);
  const cards = [];
  const diff = dayDiff(today, target);
  const isPast = diff < 0;
  const repeatEnabled = ['每周', '每月', '每年'].includes(event.repeatType);

  if (isPast) {
    const footLines = [`起始日：${formatDateWithWeekday(target)}`];
    if (event.calendarType === 'lunar') {
      footLines.push(`农历：${getLunarGanzhiMonthDayText(target)}`);
    }
    cards.push({
      tone: 'past',
      title: `${event.name}已经`,
      days: display.mainDays,
      footLines,
    });
  }

  if (!isPast || repeatEnabled) {
    const nextDate = display.nextDate || target;
    const futureDays = Math.max(0, dayDiff(today, nextDate));
    const footLines = [];
    if (event.calendarType === 'lunar') {
      footLines.push(`农历时间：${getLunarDateText(nextDate)}`);
      footLines.push(`下一次的公历时间：${formatDateWithWeekday(nextDate)}`);
    }
    cards.push({
      tone: 'future',
      title: `${event.name}还有`,
      days: futureDays,
      footLines,
    });
  }

  if (cards.length === 0) {
    cards.push({
      tone: 'future',
      title: `${event.name}还有`,
      days: Math.max(0, diff),
      footLines: [],
    });
  }

  return cards;
}

function renderDetailCardHtml(card) {
  const foot = card.footLines.length > 0
    ? card.footLines.map((line) => `<div>${escapeHtmlForHtml(line)}</div>`).join('')
    : '<div>&nbsp;</div>';
  return `
    <div class="detail-slide">
      <div class="detail-card">
        <div class="detail-card-header ${card.tone}">${escapeHtmlForHtml(card.title)}</div>
        <div class="detail-card-main">${Number(card.days) || 0}</div>
        <div class="detail-card-foot">${foot}</div>
      </div>
    </div>
  `;
}

function bindDetailSwipe(cardCount) {
  const swiper = document.getElementById('detailSwiper');
  if (!swiper) return;
  detailSwipeCardCount = cardCount;

  if (swiper._removeSwipeListeners) {
    swiper._removeSwipeListeners();
  }

  let startX = null;
  let tracking = false;

  const goToIndex = (nextIndex) => {
    detailSwipeIndex = Math.max(0, Math.min(cardCount - 1, nextIndex));
    swiper.scrollTo({
      left: detailSwipeIndex * swiper.clientWidth,
      behavior: 'smooth',
    });
  };
  detailSwipeGoTo = goToIndex;

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    startX = e.touches[0].clientX;
    tracking = true;
  };

  const onTouchEnd = (e) => {
    if (!tracking || startX === null) return;
    const endX = e.changedTouches && e.changedTouches.length > 0
      ? e.changedTouches[0].clientX
      : startX;
    const deltaX = endX - startX;
    if (deltaX < 0) {
      goToIndex(detailSwipeIndex + 1);
    } else if (deltaX > 0) {
      goToIndex(detailSwipeIndex - 1);
    } else {
      goToIndex(detailSwipeIndex);
    }
    startX = null;
    tracking = false;
  };

  const onTouchCancel = () => {
    startX = null;
    tracking = false;
  };

  swiper.addEventListener('touchstart', onTouchStart, { passive: true });
  swiper.addEventListener('touchend', onTouchEnd);
  swiper.addEventListener('touchcancel', onTouchCancel);

  swiper._removeSwipeListeners = () => {
    swiper.removeEventListener('touchstart', onTouchStart);
    swiper.removeEventListener('touchend', onTouchEnd);
    swiper.removeEventListener('touchcancel', onTouchCancel);
  };
}

function handleDetailKeydown(e) {
  const detailPage = document.getElementById('detailPage');
  if (!detailPage || !detailPage.classList.contains('active')) return;
  if (!detailSwipeGoTo || detailSwipeCardCount <= 1) return;

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    detailSwipeGoTo(detailSwipeIndex + 1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    detailSwipeGoTo(detailSwipeIndex - 1);
  }
}

function escapeHtmlForHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDateOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDiff(fromDate, toDate) {
  const from = toDateOnly(fromDate).getTime();
  const to = toDateOnly(toDate).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function handleEditFromDetail() {
  if (detailEventIndex === null || !state.events[detailEventIndex]) return;
  const event = state.events[detailEventIndex];
  editingEventIndex = detailEventIndex;
  editingOriginalName = event.name;
  detailEventIndex = null;

  document.getElementById('eventName').value = event.name;
  document.getElementById('includeStartDay').checked = !!event.includeStartDay;
  state.selectedDate = new Date(event.targetDate);
  state.selectedCalendarType = event.calendarType || 'solar';
  state.currentRepeatIndex = Math.max(0, REPEAT_OPTIONS.indexOf(event.repeatType));

  updateRepeatButton();
  renderTargetDate();
  updateCalendarToggle();

  document.getElementById('detailPage').classList.remove('active');
  switchToAddPage();
}

async function handleDeleteFromDetail() {
  if (detailEventIndex === null || !state.events[detailEventIndex]) return;
  const event = state.events[detailEventIndex];
  const ok = await openConfirmModal(`确认删除事件「${event.name}」吗？删除后不可恢复。`);
  if (!ok) return;

  state.events.splice(detailEventIndex, 1);
  saveEvents();
  detailEventIndex = null;
  closeDetailPage();
  renderCountdownList();

  if (state.currentUser?.user_name) {
    try {
      await removeEventFromCloud(event.name, state.currentUser.user_name);
    } catch (error) {
      console.error(error);
      showToast('本地已删除，云端删除失败', 'error');
      return;
    }
  }
  showToast('事件已删除', 'success');
}

function openConfirmModal(message) {
  const modal = document.getElementById('confirmModal');
  const text = document.getElementById('confirmMessage');
  if (!modal) return Promise.resolve(false);
  if (text) {
    text.textContent = message;
  }
  modal.classList.add('active');
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirmModal(result) {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.remove('active');
  }
  if (confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(result);
  }
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

function getLunarGanzhiMonthDayText(date) {
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
    is_solar: event.calendarType !== 'lunar',
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
    calendarType: row.is_solar ? 'solar' : 'lunar',
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

async function removeEventFromCloud(eventName, userName) {
  await deleteUserEventLink(userName, eventName);
  await deleteEventByName(eventName);
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
  if (trigger && trigger.disabled) return;

  const currentPage = getCurrentActivePage();

  if (trigger) {
    trigger.disabled = true;
    trigger.classList.add('loading');
  }
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
    localStorage.setItem(ACTIVE_PAGE_KEY, currentPage);
    window.setTimeout(() => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set(RELOAD_PARAM, stamp);
      window.location.replace(nextUrl.toString());
    }, 300);
  } catch (error) {
    console.error(error);
    hideRefreshOverlay();
    if (trigger) {
      trigger.disabled = false;
      trigger.classList.remove('loading');
    }
    showToast('强制刷新失败，请重试', 'error');
  }
}

function getCurrentActivePage() {
  if (document.getElementById('detailPage')?.classList.contains('active')) {
    return 'schedule';
  }
  if (document.getElementById('myPage')?.classList.contains('active')) {
    return 'me';
  }
  return 'schedule';
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
