export const STORAGE_KEY = 'countdownEvents';
export const USER_STORAGE_KEY = 'reminderCurrentUser';

export const state = {
  events: JSON.parse(localStorage.getItem(STORAGE_KEY)) || [],
  currentUser: JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null,
  
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

export function setEvents(events) {
  state.events = Array.isArray(events) ? events : [];
  saveEvents();
}

export function setCurrentUser(user) {
  state.currentUser = user || null;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function resetForm() {
  state.selectedDate = new Date();
  state.selectedCalendarType = 'solar';
  state.currentRepeatIndex = 0;
}
