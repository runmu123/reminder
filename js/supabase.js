import { SUPABASE_CONFIG } from './config.js';

const BASE_URL = `${SUPABASE_CONFIG.url}/rest/v1`;
const AUTH_HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  'Content-Type': 'application/json',
};

function buildUrl(path, params = {}) {
  const url = new URL(`${BASE_URL}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function request(path, { method = 'GET', params = {}, body, prefer } = {}) {
  const headers = { ...AUTH_HEADERS };
  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function getUserByName(userName) {
  const rows = await request('reminder_users', {
    params: {
      select: 'user_name,user_passport',
      user_name: `eq.${userName}`,
      limit: '1',
    },
  });
  return rows?.[0] || null;
}

export async function registerUser(userName, userPassport) {
  const rows = await request('reminder_users', {
    method: 'POST',
    params: { select: 'user_name,user_passport' },
    body: [{ user_name: userName, user_passport: userPassport }],
    prefer: 'return=representation',
  });
  return rows?.[0] || null;
}

export async function loginOrRegister(userName, userPassport) {
  const user = await getUserByName(userName);
  if (!user) {
    return registerUser(userName, userPassport);
  }
  if (user.user_passport !== userPassport) {
    throw new Error('用户名或密码不正确');
  }
  return user;
}

export async function upsertEvent(eventRow) {
  const rows = await request('reminder_events', {
    method: 'POST',
    params: {
      on_conflict: 'event_name',
      select: 'event_name,solar_date,lunar_date,is_solar,weekday,repeat_type,is_include_begin_day',
    },
    body: [eventRow],
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows?.[0] || null;
}

export async function upsertUserEventLink(userName, eventName) {
  await request('reminder_user_events', {
    method: 'POST',
    params: { on_conflict: 'user_name,event_name' },
    body: [{ user_name: userName, event_name: eventName }],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

export async function fetchUserEvents(userName) {
  const rows = await request('reminder_user_events', {
    params: {
      select: 'event_name,reminder_events(event_name,solar_date,lunar_date,is_solar,weekday,repeat_type,is_include_begin_day)',
      user_name: `eq.${userName}`,
      order: 'event_name.asc',
    },
  });
  return rows || [];
}

export async function deleteUserEventLink(userName, eventName) {
  await request('reminder_user_events', {
    method: 'DELETE',
    params: {
      user_name: `eq.${userName}`,
      event_name: `eq.${eventName}`,
    },
    prefer: 'return=minimal',
  });
}

export async function deleteEventByName(eventName) {
  await request('reminder_events', {
    method: 'DELETE',
    params: {
      event_name: `eq.${eventName}`,
    },
    prefer: 'return=minimal',
  });
}
