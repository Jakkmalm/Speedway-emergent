// // src/api/client.js
// export const API_BASE_URL =
//   process.env.REACT_APP_BACKEND_URL || "http://localhost:8002";

// export async function apiCall(endpoint, options = {}) {
//   const token = localStorage.getItem("speedway_token");
//   const headers = {
//     "Content-Type": "application/json",
//     ...(token && { Authorization: `Bearer ${token}` }),
//     ...(options.headers || {}),
//   };

//   const res = await fetch(`${API_BASE_URL}${endpoint}`, {
//     ...options,
//     headers,
//   });

//   if (!res.ok) {
//     let msg = "API Error";
//     try {
//       const data = await res.json();
//       msg = data.detail || msg;
//     } catch (_) {}
//     throw new Error(msg);
//   }
//   return res.json();
// }

// src/api/client.js
export const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8002";

// export const API_BASE_URL =
//   "http://localhost:8002";

export function getToken() {
  return localStorage.getItem("speedway_token");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("speedway_user") || "null");
  } catch {
    return null;
  }
}

export async function apiCall(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(
    path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
    { ...options, headers }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText} – ${text || "Request failed"}`);
    err.status = res.status;
    throw err;
  }

  // vissa endpoints (PUT tom body) kanske inte returnerar JSON
  try {
    return await res.json();
  } catch {
    return null;
  }
}

