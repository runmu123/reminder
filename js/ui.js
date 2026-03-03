import { state } from './state.js';
import { getDaysDiff, escapeHtml } from './utils.js';

const LUNAR_MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const LUNAR_DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
const LUNAR_YEAR_CACHE = new Map();

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
  const today = toDateOnly(new Date());

  state.events.forEach(event => {
    const safeName = escapeHtml(event.name);
    const display = buildEventDisplay(event, today);
    const itemClass = display.isToday ? 'countdown-item today' : 'countdown-item';
    const mainLine = display.mainLabel
      ? renderMetricLine(display.mainLabel, display.mainDays, display.mainTone)
      : '';
    const todayLine = display.isToday
      ? '<div class="countdown-today">就在今天</div>'
      : '';
    const nextLine = display.nextDays !== null
      ? renderMetricLine('距离下一次还有', display.nextDays, 'future')
      : '';
    const lunarNextSolarLine = event.calendarType === 'lunar' && display.nextDate && !display.isToday
      ? `<div class="countdown-note">下一次的公历时间为：${formatDateZh(display.nextDate)}</div>`
      : '';

    html += `
      <div class="${itemClass}">
        <div class="countdown-title">${safeName}</div>
        ${mainLine}
        ${todayLine}
        ${nextLine}
        ${lunarNextSolarLine}
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderMetricLine(label, days, tone) {
  const colorClass = tone === 'past' ? 'orange' : '';
  const safeLabel = escapeHtml(label);
  const safeDays = Number.isFinite(days) ? days : 0;
  return `
    <div class="countdown-metric">
      <div class="countdown-metric-label">${safeLabel}</div>
      <div class="countdown-value">
        <div class="countdown-number ${colorClass}">${safeDays}</div>
        <div class="countdown-unit">天</div>
      </div>
    </div>
  `;
}

function toDateOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

function dayDiff(fromDate, toDate) {
  const from = toDateOnly(fromDate).getTime();
  const to = toDateOnly(toDate).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function formatDateZh(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

function isRepeatEnabled(event) {
  return ['每周', '每月', '每年'].includes(event.repeatType);
}

function buildEventDisplay(event, today) {
  const target = toDateOnly(new Date(event.targetDate));
  const diff = dayDiff(today, target);
  const includeStart = !!event.includeStartDay;

  if (diff >= 0) {
    if (diff === 0) {
      return {
        mainLabel: '',
        mainDays: 0,
        mainTone: 'future',
        nextDays: null,
        nextDate: target,
        isToday: true,
      };
    }
    return {
      mainLabel: '还有',
      mainDays: diff,
      mainTone: 'future',
      nextDays: null,
      nextDate: target,
      isToday: false,
    };
  }

  let elapsed = Math.abs(diff);
  if (includeStart) {
    elapsed += 1;
  }

  if (!isRepeatEnabled(event)) {
    return {
      mainLabel: '已经',
      mainDays: elapsed,
      mainTone: 'past',
      nextDays: null,
      nextDate: null,
      isToday: false,
    };
  }

  const nextDate = getNextOccurrenceDate(event, today);
  const nextDays = nextDate ? Math.max(0, dayDiff(today, nextDate)) : null;
  if (nextDays === 0) {
    return {
      mainLabel: '已经',
      mainDays: elapsed,
      mainTone: 'past',
      nextDays: null,
      nextDate,
      isToday: true,
    };
  }
  return {
    mainLabel: '已经',
    mainDays: elapsed,
    mainTone: 'past',
    nextDays,
    nextDate,
    isToday: false,
  };
}

function getNextOccurrenceDate(event, today) {
  const target = toDateOnly(new Date(event.targetDate));
  const type = event.repeatType;
  const calendarType = event.calendarType || 'solar';

  if (type === '每周') {
    let candidate = new Date(target);
    while (candidate < today) {
      candidate = addDays(candidate, 7);
    }
    return candidate;
  }

  if (calendarType === 'solar') {
    return getNextSolarOccurrence(target, today, type);
  }

  return getNextLunarOccurrence(target, today, type);
}

function getNextSolarOccurrence(target, today, type) {
  const baseDay = target.getDate();
  if (type === '每月') {
    let year = today.getFullYear();
    let month = today.getMonth();
    for (let i = 0; i < 240; i++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const day = Math.min(baseDay, daysInMonth);
      const candidate = new Date(year, month, day);
      if (candidate >= today) return toDateOnly(candidate);
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return null;
  }

  if (type === '每年') {
    const baseMonth = target.getMonth();
    for (let year = today.getFullYear(); year <= today.getFullYear() + 100; year++) {
      const daysInMonth = new Date(year, baseMonth + 1, 0).getDate();
      const day = Math.min(baseDay, daysInMonth);
      const candidate = new Date(year, baseMonth, day);
      if (candidate >= today) return toDateOnly(candidate);
    }
  }

  return null;
}

function getNextLunarOccurrence(target, today, type) {
  const baseLunar = Lunar.fromDate(target);
  const targetMonth = baseLunar.getMonth();
  const targetDay = baseLunar.getDay();

  // 逐日扫描保证农历推算正确，范围足够覆盖周期需求
  for (let i = 0; i <= 2000; i++) {
    const candidate = addDays(today, i);
    const lunar = Lunar.fromDate(candidate);
    if (type === '每月') {
      if (lunar.getDay() === targetDay) return candidate;
    } else if (type === '每年') {
      if (lunar.getMonth() === targetMonth && lunar.getDay() === targetDay) return candidate;
    }
  }
  return null;
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
  const yearData = getLunarYearData(lunarYear);
  const monthOptions = yearData.months;
  if (monthOptions.length === 0) return;
  const monthIndex = monthOptions.findIndex((item) => item.value === lunarMonth);
  state.selectedMonthIndex = monthIndex >= 0 ? monthIndex : Math.max(0, Math.min(monthOptions.length - 1, state.selectedMonthIndex));
  const currentMonthValue = monthOptions[state.selectedMonthIndex]?.value || lunarMonth;
  const dayCount = monthOptions[state.selectedMonthIndex]?.dayCount || 29;
  state.selectedDayIndex = Math.max(0, Math.min(dayCount - 1, lunarDay - 1));

  renderYearWheelLunar(1900, 2100, lunarYear);
  renderMonthWheelLunar(currentMonthValue, monthOptions);
  renderDayWheelLunar(state.selectedDayIndex + 1, dayCount);
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

function renderMonthWheelLunar(current, monthOptions = null) {
  const container = document.getElementById('monthWheelInner');
  const year = 1900 + state.selectedYearIndex;
  const options = monthOptions || getLunarYearData(year).months;
  if (options.length === 0) return;

  let selectedIndex = options.findIndex((item) => item.value === current);
  if (selectedIndex < 0) {
    selectedIndex = Math.max(0, Math.min(options.length - 1, state.selectedMonthIndex));
  }
  state.selectedMonthIndex = selectedIndex;

  let html = '';
  for (let i = 0; i < options.length; i++) {
    html += `<div class="date-item ${i === selectedIndex ? 'active' : ''}" data-month-index="${i}">${options[i].label}</div>`;
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

function renderDayWheelLunar(current, dayCount = null) {
  const container = document.getElementById('dayWheelInner');
  const year = 1900 + state.selectedYearIndex;
  const monthOptions = getLunarYearData(year).months;
  if (monthOptions.length === 0) return;
  const monthValue = monthOptions[Math.max(0, Math.min(monthOptions.length - 1, state.selectedMonthIndex))].value;
  const days = dayCount || monthOptions[Math.max(0, Math.min(monthOptions.length - 1, state.selectedMonthIndex))].dayCount;
  const normalizedCurrent = Math.max(1, Math.min(days, current));
  state.selectedDayIndex = normalizedCurrent - 1;

  let html = '';
  for (let i = 0; i < days; i++) {
    html += `<div class="date-item ${i + 1 === normalizedCurrent ? 'active' : ''}" data-day="${i + 1}">${LUNAR_DAY_NAMES[i]}</div>`;
  }
  container.innerHTML = html;
  updateWheelPosition(container, state.selectedDayIndex);
  attachWheelEvents(container, 'lunarDay');
}

function formatLunarMonthLabel(monthValue) {
  const absMonth = Math.abs(monthValue);
  const baseName = LUNAR_MONTH_NAMES[absMonth - 1] || `${absMonth}月`;
  return monthValue < 0 ? `闰${baseName}` : baseName;
}

function getLunarYearData(year) {
  if (LUNAR_YEAR_CACHE.has(year)) {
    return LUNAR_YEAR_CACHE.get(year);
  }

  const monthOrder = [];
  const monthMap = new Map();
  const dateMap = new Map();
  let ganZhi = '';
  const cursor = new Date(year - 1, 10, 1);
  const end = new Date(year + 1, 2, 1);

  while (cursor <= end) {
    const solarDate = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const lunar = Lunar.fromDate(solarDate);
    if (lunar.getYear() === year) {
      if (!ganZhi) {
        ganZhi = lunar.getYearInGanZhi();
      }
      const monthValue = lunar.getMonth();
      const dayValue = lunar.getDay();
      if (!monthMap.has(monthValue)) {
        monthMap.set(monthValue, {
          value: monthValue,
          label: formatLunarMonthLabel(monthValue),
          dayCount: 0
        });
        monthOrder.push(monthValue);
      }
      const monthInfo = monthMap.get(monthValue);
      if (dayValue > monthInfo.dayCount) {
        monthInfo.dayCount = dayValue;
      }
      const key = `${monthValue}-${dayValue}`;
      if (!dateMap.has(key)) {
        dateMap.set(key, solarDate);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const months = monthOrder.map((monthValue) => monthMap.get(monthValue));
  const data = { ganZhi, months, dateMap };
  LUNAR_YEAR_CACHE.set(year, data);
  return data;
}

function normalizeLunarSelection() {
  const lunarYear = 1900 + state.selectedYearIndex;
  const yearData = getLunarYearData(lunarYear);
  const monthCount = yearData.months.length;
  if (monthCount === 0) return null;

  state.selectedMonthIndex = Math.max(0, Math.min(monthCount - 1, state.selectedMonthIndex));
  const monthInfo = yearData.months[state.selectedMonthIndex];
  state.selectedDayIndex = Math.max(0, Math.min(monthInfo.dayCount - 1, state.selectedDayIndex));

  return { lunarYear, yearData, monthInfo };
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function updateWheelPosition(wheelInner, index) {
  const offset = -index * 50 + 75;
  wheelInner.style.transform = `translateY(${offset}px)`;
}

function attachWheelEvents(wheelInner, type) {
  if (wheelInner._removeWheelListeners) {
    wheelInner._removeWheelListeners();
  }

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  const handleStart = (clientY) => {
    isDragging = true;
    startY = clientY;
    const transform = wheelInner.style.transform;
    const match = transform.match(/translateY\((-?\d+)px\)/);
    currentY = match ? parseInt(match[1]) : 0;
  };

  const handleMove = (clientY) => {
    if (!isDragging) return;
    const items = wheelInner.querySelectorAll('.date-item');
    const deltaY = clientY - startY;
    const newY = currentY + deltaY;
    const maxOffset = 75;
    const minOffset = -(items.length - 1) * 50 + 75;
    wheelInner.style.transform = `translateY(${Math.max(minOffset, Math.min(maxOffset, newY))}px)`;
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    const items = wheelInner.querySelectorAll('.date-item');
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
          const selection = normalizeLunarSelection();
          if (!selection) return;
          renderMonthWheelLunar(selection.monthInfo.value, selection.yearData.months);
          renderDayWheelLunar(state.selectedDayIndex + 1, selection.monthInfo.dayCount);
        } else {
          const year = 1900 + clampedIndex;
          renderMonthWheel(1, 12, 1, 'solar');
          renderDayWheelSolar(year, 0, 1);
        }
      } else if (type === 'month' || type === 'lunarMonth') {
        state.selectedMonthIndex = clampedIndex;
        if (state.selectedCalendarType === 'lunar') {
          const selection = normalizeLunarSelection();
          if (!selection) return;
          renderMonthWheelLunar(selection.monthInfo.value, selection.yearData.months);
          renderDayWheelLunar(state.selectedDayIndex + 1, selection.monthInfo.dayCount);
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

  const onTouchStart = (e) => handleStart(e.touches[0].clientY);
  const onTouchMove = (e) => handleMove(e.touches[0].clientY);
  const onTouchEnd = () => handleEnd();
  const onMouseDown = (e) => {
    handleStart(e.clientY);
    e.preventDefault();
  };
  const onMouseMove = (e) => {
    if (isDragging) {
      handleMove(e.clientY);
    }
  };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => handleEnd();

  // 鼠标滚轮支持
  const onWheel = (e) => {
    e.preventDefault();
    if (isDragging) return;

    const items = wheelInner.querySelectorAll('.date-item');
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
          const selection = normalizeLunarSelection();
          if (!selection) return;
          renderMonthWheelLunar(selection.monthInfo.value, selection.yearData.months);
          renderDayWheelLunar(state.selectedDayIndex + 1, selection.monthInfo.dayCount);
        } else {
          const year = 1900 + finalClamped;
          renderMonthWheel(1, 12, 1, 'solar');
          renderDayWheelSolar(year, 0, 1);
        }
      } else if (type === 'month' || type === 'lunarMonth') {
        state.selectedMonthIndex = finalClamped;
        if (state.selectedCalendarType === 'lunar') {
          const selection = normalizeLunarSelection();
          if (!selection) return;
          renderMonthWheelLunar(selection.monthInfo.value, selection.yearData.months);
          renderDayWheelLunar(state.selectedDayIndex + 1, selection.monthInfo.dayCount);
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
  };

  wheelInner.addEventListener('touchstart', onTouchStart);
  wheelInner.addEventListener('touchmove', onTouchMove);
  wheelInner.addEventListener('touchend', onTouchEnd);
  wheelInner.addEventListener('mousedown', onMouseDown);
  wheelInner.addEventListener('mousemove', onMouseMove);
  wheelInner.addEventListener('mouseup', onMouseUp);
  wheelInner.addEventListener('mouseleave', onMouseLeave);
  wheelInner.addEventListener('wheel', onWheel);

  wheelInner._removeWheelListeners = () => {
    wheelInner.removeEventListener('touchstart', onTouchStart);
    wheelInner.removeEventListener('touchmove', onTouchMove);
    wheelInner.removeEventListener('touchend', onTouchEnd);
    wheelInner.removeEventListener('mousedown', onMouseDown);
    wheelInner.removeEventListener('mousemove', onMouseMove);
    wheelInner.removeEventListener('mouseup', onMouseUp);
    wheelInner.removeEventListener('mouseleave', onMouseLeave);
    wheelInner.removeEventListener('wheel', onWheel);
  };
}

function updateSelectedDate() {
  if (state.selectedCalendarType === 'solar') {
    const year = 1900 + state.selectedYearIndex;
    const month = state.selectedMonthIndex;
    const days = getDaysInMonth(year, month);
    const day = Math.min(state.selectedDayIndex + 1, days);
    state.selectedDate = new Date(year, month, day);
  } else {
    const selection = normalizeLunarSelection();
    if (!selection) return;
    const lunarDay = state.selectedDayIndex + 1;
    const key = `${selection.monthInfo.value}-${lunarDay}`;
    const mappedSolarDate = selection.yearData.dateMap.get(key);
    if (mappedSolarDate) {
      state.selectedDate = new Date(mappedSolarDate.getFullYear(), mappedSolarDate.getMonth(), mappedSolarDate.getDate());
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
