import { showToast } from './toast.js';
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];

const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

export function getWeekday(date) {
    return WEEKDAYS[date.getDay()];
}

export function formatSolarDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekday = getWeekday(date);
    return `${year}年${month}月${day}日 ${weekday}`;
}

export function formatLunarDate(date) {
    const year = date.getFullYear();
    const lunar = Lunar.fromDate(date);
    const lunarYear = lunar.getYearInGanZhi();
    const lunarMonth = lunar.getMonthInChinese();
    const lunarDay = lunar.getDayInChinese();
    const weekday = getWeekday(date);
    return `${year} ${lunarYear} ${lunarMonth}月${lunarDay} ${weekday}`;
}

export function getDaysDiff(targetDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function showAlert(message) {
    showToast(message, 'info');
}

export { WEEKDAYS, LUNAR_MONTHS, LUNAR_DAYS };
