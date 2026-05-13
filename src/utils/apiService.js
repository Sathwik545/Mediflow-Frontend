/**
 * apiService.js — MediFlow Centralized HTTP Client
 *
 * Single place for all backend API calls. Handles:
 *   • Base URL  (defaults to http://localhost:8080, overridable via .env)
 *   • Content-Type header
 *   • Auth token injection from localStorage
 *   • ApiResponse envelope unwrapping — callers receive `data` directly
 *   • Error shaping — thrown errors always have .response.{status, data}
 *     so errorHandler.js can parse them uniformly
 *
 * Backend base: http://localhost:8080/api/v1
 * Swagger UI:   http://localhost:8080/swagger-ui/index.html
 *
 * package.json sets "proxy": "http://localhost:8080" so in development
 * you can call '/api/v1/...' directly without CORS issues.
 *
 * @project MediFlow Hospital Management System
 */

// Override with REACT_APP_API_URL in .env for staging / production
const API_BASE = process.env.REACT_APP_API_URL || '';

const TOKEN_KEY         = 'mediflow_token';
const REFRESH_TOKEN_KEY = 'mediflow_refresh_token';
const USERNAME_KEY      = 'mediflow_username';

// ─── JWT Expiry Check ─────────────────────────────────────────────────────────

/**
 * Decodes the JWT payload (no signature verification — server does that).
 * Returns the parsed payload object, or null if the token is malformed.
 */
const decodeJwtPayload = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

/**
 * Returns true only if a token exists in localStorage AND its exp claim
 * is still in the future. Clears the session automatically if the token
 * has expired so the user is redirected to login on next ProtectedRoute check.
 */
const checkIsAuthenticated = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    clearSessionData();
    return false;
  }
  const isExpired = payload.exp * 1000 < Date.now();
  if (isExpired) {
    clearSessionData();
    return false;
  }
  return true;
};

// Internal helper used before the public export is declared
const clearSessionData = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
};

// ─── Core Fetch Wrapper ───────────────────────────────────────────────────────

/**
 * Low-level HTTP request.  All public methods delegate here.
 *
 * @param {string} endpoint   - e.g. '/api/v1/patients'
 * @param {RequestInit} opts  - native fetch options
 * @returns {Promise<*>}      - resolves with ApiResponse.data on success
 * @throws {Error}            - error.response = { status, data: ApiResponse }
 */
const request = async (endpoint, opts = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  // Always parse body — even error responses carry the ApiResponse envelope
  const apiResponse = await response.json();

  if (!response.ok || apiResponse.success === false) {
    // 401 mid-session = token expired or revoked on the server side.
    // Skip the redirect for the login endpoint itself to avoid a loop.
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      clearSessionData();
      window.location.replace('/login');
    }
    const err = new Error(apiResponse.message || 'Request failed');
    // Attach structured info so errorHandler.parseApiError() can read it
    err.response = { status: response.status, data: apiResponse };
    throw err;
  }

  // Unwrap the envelope — callers get the `data` payload directly
  return apiResponse.data;
};

// ─── HTTP Method Helpers ──────────────────────────────────────────────────────

/** @param {string} endpoint */
export const get = (endpoint) =>
  request(endpoint, { method: 'GET' });

/**
 * @param {string} endpoint
 * @param {Object} body - will be JSON-serialised
 */
export const post = (endpoint, body) =>
  request(endpoint, { method: 'POST', body: JSON.stringify(body) });

/**
 * @param {string} endpoint
 * @param {Object} body
 */
export const put = (endpoint, body) =>
  request(endpoint, { method: 'PUT', body: JSON.stringify(body) });

/** @param {string} endpoint */
export const del = (endpoint) =>
  request(endpoint, { method: 'DELETE' });

// ─── Auth Token Helpers ───────────────────────────────────────────────────────

export const setAuthToken    = (token)    => localStorage.setItem(TOKEN_KEY, token);
export const clearAuthToken  = ()         => localStorage.removeItem(TOKEN_KEY);
export const isAuthenticated = ()         => checkIsAuthenticated();

export const setRefreshToken = (token)    => localStorage.setItem(REFRESH_TOKEN_KEY, token);
export const getRefreshToken = ()         => localStorage.getItem(REFRESH_TOKEN_KEY);
export const clearRefreshToken = ()       => localStorage.removeItem(REFRESH_TOKEN_KEY);

export const setUsername = (username)     => localStorage.setItem(USERNAME_KEY, username);
export const getUsername = ()             => localStorage.getItem(USERNAME_KEY) || '';
export const clearUsername = ()           => localStorage.removeItem(USERNAME_KEY);

/** Wipes all session data — call on logout */
export const clearSession = () => clearSessionData();

// ─── Default Export ───────────────────────────────────────────────────────────

const apiService = {
  get, post, put, del,
  setAuthToken, clearAuthToken, isAuthenticated,
  setRefreshToken, getRefreshToken, clearRefreshToken,
  setUsername, getUsername, clearUsername,
  clearSession,
};

export default apiService;
