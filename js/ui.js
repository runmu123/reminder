import { state } from './state.js';
import { getDaysDiff, escapeHtml } from './utils.js';

export function renderClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  document.getElementById('hours').textContent = hours;
  document.getElementById('minutes').textContent = minutes;
  document.getElementById('seconds').textContent = seconds;
}

export function renderDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[now.getDay()];

  document.getElementById('date').textContent = `${month}月${day}日 ${weekday}`;
}

export function renderCountdownList() {
  const container = document.getElementById('countdownList');
  let html = '';

  state.events.forEach(event => {
    const diffDays = getDaysDiff(event.targetDate);
    const isFuture = diffDays >= 0;
    const daysText = isFuture ? '还有' : '已经';
    const daysNumber = Math.abs(diffDays);
    const colorClass = isFuture ? '' : 'orange';
    const safeName = escapeHtml(event.name);

    html += `
      <div class="countdown-item">
        <div class="countdown-title">${safeName}${daysText}</div>
        <div class="countdown-value">
          <div class="countdown-number ${colorClass}">${daysNumber}</div>
          <div class="countdown-unit">天</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function renderTargetDate() {
  const display = document.getElementById('targetDateDisplay');
  if (state.selectedCalendarType === 'solar') {
    const year = state.selectedDate.getFullYear();
    const month = String(state.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(state.selectedDate.getDate()).padStart(2, '0');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[state.selectedDate.getDay()];
    display.textContent = `${year}年${month}月${day}日 ${weekday}`;
  } else {
    const lunar = Lunar.fromDate(state.selectedDate);
    const year = state.selectedDate.getFullYear();
    const lunarYear = lunar.getYearInGanZhi();
    const lunarMonth = lunar.getMonthInChinese();
    const lunarDay = lunar.getDayInChinese();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[state.selectedDate.getDay()];
    display.textContent = `${year} ${lunarYear} ${lunarMonth}月${lunarDay} ${weekday}`;
  }
}

export function updateCalendarToggle() {
  const buttons = document.querySelectorAll('.calendar-toggle .toggle-btn');
  buttons.forEach(btn => {
    if (btn.dataset.type === state.selectedCalendarType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export function switchToAddPage() {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('addEventPage').classList.add('active');
  document.getElementById('myPage').classList.remove('active');
  setActiveNav('schedule');
  renderTargetDate();
  updateCalendarToggle();
}

export function switchToMainPage() {
  document.getElementById('mainPage').classList.remove('hidden');
  document.getElementById('addEventPage').classList.remove('active');
  document.getElementById('myPage').classList.remove('active');
  setActiveNav('schedule');
}

export function switchToMyPage() {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('addEventPage').classList.remove('active');
  document.getElementById('myPage').classList.add('active');
  setActiveNav('me');
}

export function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    if (item.dataset.page === page) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

export function showRefreshOverlay() {
  const overlay = document.getElementById('refreshOverlay');
  if (overlay) {
    overlay.classList.add('active');
  }
}

export function updateRefreshProgress(percent, text) {
  const bar = document.getElementById('refreshProgressBar');
  const label = document.getElementById('refreshProgressText');
  if (bar) {
    const normalized = Math.max(0, Math.min(100, percent));
    bar.style.width = `${normalized}%`;
  }
  if (label && text) {
    label.textContent = text;
  }
}

export function hideRefreshOverlay() {
  const overlay = document.getElementById('refreshOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

export function openDatePicker() {
  state.datePickerVisible = true;
  document.getElementById('datePickerModal').classList.add('active');
  initDatePicker();
}

export function closeDatePicker() {
  state.datePickerVisible = false;
  document.getElementById('datePickerModal').classList.remove('active');
}

export function initDatePicker() {
  const yearLabel = document.getElementById('yearLabel');
  const monthLabel = document.getElementById('monthLabel');
  const dayLabel = document.getElementById('dayLabel');

  yearLabel.textContent = '年';
  monthLabel.textContent = '月';
  dayLabel.textContent = '日';

  if (state.selectedCalendarType === 'solar') {
    initSolarPicker();
  } else {
    initLunarPicker();
  }
}

function initSolarPicker() {
  const year = state.selectedDate.getFullYear();
  const month = state.selectedDate.getMonth();
  const day = state.selectedDate.getDate() - 1;

  state.selectedYearIndex = year - 1900;
  state.selectedMonthIndex = month;
  state.selectedDayIndex = day;

  renderYearWheel(1900, 2100, year, 'solar');
  renderMonthWheel(1, 12, month + 1, 'solar');
  renderDayWheelSolar(year, month, day + 1);
}

function initLunarPicker() {
  const lunar = Lunar.fromDate(state.selectedDate);
  const lunarYear = lunar.getYear();
  const lunarMonth = lunar.getMonth();
  const lunarDay = lunar.getDay();

  state.selectedYearIndex = lunarYear - 1900;
  state.selectedMonthIndex = lunarMonth - 1;
  state.selectedDayIndex = lunarDay - 1;

  renderYearWheelLunar(1900, 2100, lunarYear);
  renderMonthWheelLunar(lunarMonth);
  renderDayWheelLunar(lunarDay);
}

function renderYearWheel(min, max, current, type) {
  const container = document.getElementById('yearWheelInner');
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<div class="date-item ${i === current ? 'active' : ''}" data-year="${i}">${i}年</div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedYearIndex);
  attachWheelEvents(container, 'year', min);
}

function renderYearWheelLunar(min, max, current) {
  const container = document.getElementById('yearWheelInner');
  let html = '';
  for (let i = min; i <= max; i++) {
    const l = Lunar.fromYmd(i, 1, 1);
    const ganZhi = l.getYearInGanZhi();
    html += `<div class="date-item ${i === current ? 'active' : ''}" data-year="${i}">
      <span class="lunar-year"><span>${i}</span><span>${ganZhi}</span></span>
    </div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedYearIndex);
  attachWheelEvents(container, 'lunarYear', min);
}

function renderMonthWheel(min, max, current, type) {
  const container = document.getElementById('monthWheelInner');
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<div class="date-item ${i === current ? 'active' : ''}" data-month="${i}">${String(i).padStart(2, '0')}月</div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedMonthIndex);
  attachWheelEvents(container, 'month');
}

function renderMonthWheelLunar(current) {
  const container = document.getElementById('monthWheelInner');
  const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  let html = '';
  for (let i = 0; i < 12; i++) {
    html += `<div class="date-item ${i + 1 === current ? 'active' : ''}" data-month="${i + 1}">${LUNAR_MONTHS[i]}</div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedMonthIndex);
  attachWheelEvents(container, 'lunarMonth');
}

function renderDayWheelSolar(year, month, current) {
  const days = getDaysInMonth(year, month);
  const container = document.getElementById('dayWheelInner');
  let html = '';
  for (let i = 1; i <= days; i++) {
    html += `<div class="date-item ${i === current ? 'active' : ''}" data-day="${i}">${String(i).padStart(2, '0')}日</div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedDayIndex);
  attachWheelEvents(container, 'day');
}

function renderDayWheelLunar(current) {
  const container = document.getElementById('dayWheelInner');
  const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  let html = '';
  for (let i = 0; i < 30; i++) {
    html += `<div class="date-item ${i + 1 === current ? 'active' : ''}" data-day="${i + 1}">${LUNAR_DAYS[i]}</div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedDayIndex);
  attachWheelEvents(container, 'lunarDay');
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function updateWheelPosition(wheelInner, index) {
  const offset = -index * 50 + 75;
  wheelInner.style.transform = `translateY(${offset}px)`;
}

function attachWheelEvents(wheelInner, type, offset = 0) {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let isScrolling = false;
  const items = wheelInner.querySelectorAll('.date-item');

  const handleStart = (clientY) => {
    isDragging = true;
    startY = clientY;
    const transform = wheelInner.style.transform;
    const match = transform.match(/translateY\((-?\d+)px\)/);
    currentY = match ? parseInt(match[1]) : 0;
  };

  const handleMove = (clientY) => {
    if (!isDragging) return;
    const deltaY = clientY - startY;
    const newY = currentY + deltaY;
    const maxOffset = 75;
    const minOffset = -(items.length - 1) * 50 + 75;
    wheelInner.style.transform = `translateY(${Math.max(minOffset, Math.min(maxOffset, newY))}px)`;
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    const transform = wheelInner.style.transform;
    const match = transform.match(/translateY\((-?\d+)px\)/);
    const currentOffset = match ? parseInt(match[1]) : 0;
    const newIndex = Math.round((75 - currentOffset) / 50);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, newIndex));

    // 防抖处理
    clearTimeout(wheelInner.updateTimer);
    wheelInner.updateTimer = setTimeout(() => {
      if (type === 'year' || type === 'lunarYear') {
        state.selectedYearIndex = clampedIndex;
        if (state.selectedCalendarType === 'lunar') {
          renderMonthWheelLunar(1);
          renderDayWheelLunar(1);
        } else {
          const year = 1900 + clampedIndex;
          renderMonthWheel(1, 12, 1, 'solar');
          renderDayWheelSolar(year, 0, 1);
        }
      } else if (type === 'month' || type === 'lunarMonth') {
        state.selectedMonthIndex = clampedIndex;
        if (state.selectedCalendarType === 'lunar') {
          renderDayWheelLunar(1);
        } else {
          const year = 1900 + state.selectedYearIndex;
          renderDayWheelSolar(year, clampedIndex, 1);
        }
      } else if (type === 'day' || type === 'lunarDay') {
        state.selectedDayIndex = clampedIndex;
      }

      updateSelectedDate();
      initDatePicker();
    }, 100);
  };

  wheelInner.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY));
  wheelInner.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientY));
  wheelInner.addEventListener('touchend', handleEnd);

  wheelInner.addEventListener('mousedown', (e) => {
    handleStart(e.clientY);
    e.preventDefault();
  });
  wheelInner.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleMove(e.clientY);
    }
  });
  wheelInner.addEventListener('mouseup', handleEnd);
  wheelInner.addEventListener('mouseleave', handleEnd);

  // 鼠标滚轮支持
  wheelInner.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isDragging) return;

    const transform = wheelInner.style.transform;
    const match = transform.match(/translateY\((-?\d+)px\)/);
    const currentOffset = match ? parseInt(match[1]) : 0;
    // 反转滚轮方向：滚轮向下时选择后续项，向上时选择前序项
    const deltaY = -Math.sign(e.deltaY) * 20;
    const newY = currentOffset + deltaY;
    const maxOffset = 75;
    const minOffset = -(items.length - 1) * 50 + 75;
    wheelInner.style.transform = `translateY(${Math.max(minOffset, Math.min(maxOffset, newY))}px)`;

    // 自动回弹
    clearTimeout(wheelInner.autoScrollTimer);
    wheelInner.autoScrollTimer = setTimeout(() => {
      const finalOffset = wheelInner.style.transform;
      const finalMatch = finalOffset.match(/translateY\((-?\d+)px\)/);
      const finalCurrent = finalMatch ? parseInt(finalMatch[1]) : 0;
      const finalIndex = Math.round((75 - finalCurrent) / 50);
      const finalClamped = Math.max(0, Math.min(items.length - 1, finalIndex));

      if (type === 'year' || type === 'lunarYear') {
        state.selectedYearIndex = finalClamped;
        if (state.selectedCalendarType === 'lunar') {
          renderMonthWheelLunar(1);
          renderDayWheelLunar(1);
        } else {
          const year = 1900 + finalClamped;
          renderMonthWheel(1, 12, 1, 'solar');
          renderDayWheelSolar(year, 0, 1);
        }
      } else if (type === 'month' || type === 'lunarMonth') {
        state.selectedMonthIndex = finalClamped;
        if (state.selectedCalendarType === 'lunar') {
          renderDayWheelLunar(1);
        } else {
          const year = 1900 + state.selectedYearIndex;
          renderDayWheelSolar(year, finalClamped, 1);
        }
      } else if (type === 'day' || type === 'lunarDay') {
        state.selectedDayIndex = finalClamped;
      }

      updateSelectedDate();
      initDatePicker();
    }, 500);
  });
}

function updateSelectedDate() {
  if (state.selectedCalendarType === 'solar') {
    const year = 1900 + state.selectedYearIndex;
    const month = state.selectedMonthIndex;
    const days = getDaysInMonth(year, month);
    const day = Math.min(state.selectedDayIndex + 1, days);
    state.selectedDate = new Date(year, month, day);
  } else {
    const lunarYear = 1900 + state.selectedYearIndex;
    const lunarMonth = state.selectedMonthIndex + 1;
    const lunarDay = state.selectedDayIndex + 1;
    try {
      const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay);
      state.selectedDate = lunar.getSolar().toDate();
    } catch (e) {
      state.selectedDate = new Date();
    }
  }
}

export function updateRepeatButton() {
  const options = ['不重复', '每周', '每月', '每年'];
  document.getElementById('repeatType').textContent = options[state.currentRepeatIndex] + ' ▾';
}

export function resetFormUI() {
  document.getElementById('eventName').value = '';
  document.getElementById('includeStartDay').checked = false;
  state.currentRepeatIndex = 0;
  updateRepeatButton();
  state.selectedDate = new Date();
  state.selectedCalendarType = 'solar';
  renderTargetDate();
  updateCalendarToggle();
}
