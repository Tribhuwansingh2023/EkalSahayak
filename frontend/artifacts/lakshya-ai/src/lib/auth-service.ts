/**
 * Authentication & JWT Client Service for EkalSahayak EdTech.
 * Interacts with backend FastAPI MongoDB auth endpoints.
 */

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  name: string;
  grade: number;
  medium: string;
  mastery_map?: Record<string, number>;
}

export interface AuthResponseData {
  success: boolean;
  access_token: string;
  token_type: string;
  user: AuthUser;
  message: string;
}

const TOKEN_KEY = 'ekalsahayak_token';
const USER_KEY = 'ekalsahayak_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
}

export async function ensureAuthenticatedSession(): Promise<string | null> {
  const token = getStoredToken();
  if (token) return token;

  try {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        saveAuthSession(data.access_token, data.user);
        return data.access_token;
      }
    }
  } catch (err) {
    console.warn('Could not auto-create guest session:', err);
  }
  return null;
}

export async function loginUser(usernameOrEmail: string, password: string): Promise<AuthResponseData> {
  const resp = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username_or_email: usernameOrEmail,
      password: password
    })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || 'Login failed. Please check your credentials.');
  }

  saveAuthSession(data.access_token, data.user);
  return data;
}

export async function registerUser(details: {
  username: string;
  email: string;
  password: string;
  name: string;
  grade: number;
  medium?: string;
  home_dialect?: string;
}): Promise<AuthResponseData> {
  const resp = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: details.username,
      email: details.email,
      password: details.password,
      name: details.name,
      grade: details.grade,
      medium: details.medium || 'Odia',
      home_dialect: details.home_dialect || 'Kui / Desia'
    })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || 'Registration failed.');
  }

  saveAuthSession(data.access_token, data.user);
  return data;
}

export async function verifyCurrentSession(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const resp = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!resp.ok) {
      clearAuthSession();
      return null;
    }

    const data = await resp.json();
    if (data.user) {
      saveAuthSession(token, data.user);
      return data.user;
    }
  } catch {
    // If backend offline, rely on cached stored user
    return getStoredUser();
  }
  return null;
}
