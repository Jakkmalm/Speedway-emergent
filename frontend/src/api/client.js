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




// TESTAR NY UNDER
// src/api/client.js
// export const API_BASE_URL =
//   process.env.REACT_APP_BACKEND_URL;


// // LOKAL UTVECKLING:
// // export const API_BASE_URL =
// //   "http://localhost:8002";

// export function getToken() {
//   return localStorage.getItem("speedway_token");
// }

// export function getUser() {
//   try {
//     return JSON.parse(localStorage.getItem("speedway_user") || "null");
//   } catch {
//     return null;
//   }
// }

// export async function apiCall(path, options = {}) {
//   const token = getToken();
//   const headers = {
//     "Content-Type": "application/json",
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     ...(options.headers || {}),
//   };

//   const res = await fetch(
//     path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
//     { ...options, headers }
//   );

//   // Centralt 401/403-hantering → utlogga och skicka till /auth TESTAR
//   if (res.status === 401 || res.status === 403) {
//     try {
//       localStorage.removeItem("speedway_token");
//       localStorage.removeItem("speedway_user");
//     } catch {}
//     // undvik loop om man redan står på auth
//     if (window.location.pathname !== "/auth") {
//       window.location.replace("/auth");
//     }
//     // kasta ett fel ändå för anroparen
//     const text = await res.text().catch(() => "");
//     const err = new Error(`${res.status} ${res.statusText} – ${text || "Unauthorized"}`);
//     err.status = res.status;
//     throw err;
//   }

//   if (!res.ok) {
//     const text = await res.text().catch(() => "");
//     const err = new Error(`${res.status} ${res.statusText} – ${text || "Request failed"}`);
//     err.status = res.status;
//     throw err;
//   }

//   // vissa endpoints (PUT tom body) kanske inte returnerar JSON
//   try {
//     return await res.json();
//   } catch {
//     return null;
//   }
// }

// src/api/client.js
export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;
// export const API_BASE_URL = "http://localhost:8002";

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

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const err = new Error("Nätverksfel – kunde inte nå servern.");
    err.cause = e;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json");
  const payload = isJSON
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    const detail =
      (payload && (payload.detail || payload.message)) ||
      (typeof payload === "string" ? payload : "") ||
      `${res.status} ${res.statusText}`;

    const err = new Error(detail);
    err.status = res.status;

    // ⛔️ Fångar ogiltig/återkallad session globalt
    if (res.status === 401 && token) {
      // Lägg en notis som AuthPage plockar upp och visar som toast
      sessionStorage.setItem(
        "auth_notice",
        typeof detail === "string"
          ? detail
          : "Din session är ogiltig eller har återkallats. Logga in igen."
      );

      // Rensa lokal auth om något hann ligga kvar
      try {
        localStorage.removeItem("speedway_token");
        localStorage.removeItem("speedway_user");
      } catch { }

      // Sänd global signal så att AuthContext direkt nollar användaren
      try {
        window.dispatchEvent(
          new CustomEvent("auth:logout", { detail: { reason: "401" } })
        );
      } catch { }
    }

    throw err;
  }

  return isJSON ? payload : null;
}


