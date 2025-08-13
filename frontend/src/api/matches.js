// src/api/matches.js
import { apiCall, API_BASE_URL } from "./client";

// ---- Matches (list, details) ----
export const getMatches = () => apiCall("/api/matches");
export const getMatchById = (id) => apiCall(`/api/matches/${id}`);
export const deleteMatch = (id) =>
  apiCall(`/api/matches/${id}`, { method: "DELETE", body: JSON.stringify({}) });

// ---- Create from official / list official ----
export const getOfficialMatches = async () => {
  const token = localStorage.getItem("speedway_token");
  const res = await fetch(`${API_BASE_URL}/api/official-matches`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Kunde inte ladda officiella matcher");
  return res.json();
};

export const createFromOfficial = (official_match_id) =>
  apiCall("/api/matches/from-official", {
    method: "POST",
    body: JSON.stringify({ official_match_id }),
  });

// ---- Confirm match ----
export const confirmMatch = (id) =>
  apiCall(`/api/matches/${id}/confirm`, { method: "PUT" });

// ---- Heat results & riders ----
export const clearHeatResults = (matchId, heatNumber) =>
  apiCall(`/api/matches/${matchId}/heat/${heatNumber}/result`, {
    method: "PUT",
    body: JSON.stringify({ results: [] }),
  });

export const putHeatResults = (matchId, heatNumber, results) =>
  apiCall(`/api/matches/${matchId}/heat/${heatNumber}/result`, {
    method: "PUT",
    body: JSON.stringify({ results }),
  });

// export const updateHeatRiders = (matchId, heatNumber, assignments) => {
//   const token = localStorage.getItem("speedway_token");
//   return fetch(
//     `${API_BASE_URL}/api/matches/${matchId}/heat/${heatNumber}/riders`,
//     {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//         ...(token && { Authorization: `Bearer ${token}` }),
//       },
//       body: JSON.stringify(assignments),
//     }
//   ).then(async (res) => {
//     if (!res.ok) {
//       const data = await res.json().catch(() => ({}));
//       throw new Error(data.detail || "Kunde inte uppdatera heat-uppställningen");
//     }
//     return res.json();
//   });
// };

export const updateHeatRiders = (matchId, heatNumber, assignments) =>
  apiCall(`/api/matches/${matchId}/heat/${heatNumber}/riders`, {
    method: "PUT",
    body: JSON.stringify(assignments),
  });

// ---- User matches (My Matches) ----
export const getUserMatches = () => apiCall("/api/user/matches");
export const resolveUserMatch = (userMatchId, action) =>
  apiCall(`/api/user/matches/${userMatchId}/resolve`, {
    method: "PUT",
    body: JSON.stringify({ action }),
  });
