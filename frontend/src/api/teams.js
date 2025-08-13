// src/api/teams.js
import { apiCall } from "./client";

export const getTeams = () => apiCall("/api/teams");
export const getTeamRiders = (teamId) =>
  apiCall(`/api/teams/${teamId}/riders`);
