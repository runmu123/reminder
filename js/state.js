export const STORAGE_KEY = 'countdownEvents';
export const USER_STORAGE_KEY = 'reminderCurrentUser';
export const TODO_STORAGE_KEY = 'todoItems';
export const TODO_FILTER_KEY = 'todoFilter';

export const state = {
  events: JSON.parse(localStorage.getItem(STORAGE_KEY)) || [],
  todos: JSON.parse(localStorage.getItem(TODO_STORAGE_KEY)) || [],
  currentUser: JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null,
  searchKeyword: '',
  todoFilter: localStorage.getItem(TODO_FILTER_KEY) || 'all',
  
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

export function saveTodos() {
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.todos));
}

export function setTodos(todos) {
  state.todos = Array.isArray(todos) ? todos : [];
  saveTodos();
}

export function addTodo(todo) {
  state.todos.push(todo);
  saveTodos();
}

export function updateTodo(id, patch) {
  const index = state.todos.findIndex((item) => item.id === id);
  if (index < 0) {
    return false;
  }
  state.todos[index] = {
    ...state.todos[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveTodos();
  return true;
}

export function removeTodo(id) {
  const nextTodos = state.todos.filter((item) => item.id !== id);
  if (nextTodos.length === state.todos.length) {
    return false;
  }
  state.todos = nextTodos;
  saveTodos();
  return true;
}

export function setTodoFilter(filter) {
  state.todoFilter = filter || 'all';
  localStorage.setItem(TODO_FILTER_KEY, state.todoFilter);
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
