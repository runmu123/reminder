export const STORAGE_KEY = 'countdownEvents';

export const state = {
  events: JSON.parse(localStorage.getItem(STORAGE_KEY)) || [],
  
  selectedCalendarType: 'solar',
  
  selectedDate: new Date(),
  
  datePickerVisible: false,
  
  selectedYearIndex: 0,
  selectedMonthIndex: 0,
  selectedDayIndex: 0,
  
  currentRepeatIndex: 0,
  
  timerId: null,
};

export function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
}

export function addEvent(event) {
  state.events.push(event);
  saveEvents();
}

export function resetForm() {
  state.selectedDate = new Date();
  state.selectedCalendarType = 'solar';
  state.currentRepeatIndex = 0;
}
