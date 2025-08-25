import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMatches,
  getMatchById,
  getUserMatches,
  getOfficialMatches,
  createFromOfficial,
  deleteMatch,
  deleteUserMatch,
  deleteUserMatchCascade,
  confirmMatch,
  clearHeatResults,
  putHeatResults,
  updateHeatRiders,
  resolveUserMatch,
} from "../api/matches";

// Centrala query keys för konsekvens
const qk = {
  matches: ["matches"],
  match: (id) => ["match", id],
  userMatches: ["userMatches"],
  officialMatches: ["officialMatches"],
};

// --- Läsfrågor (queries) ---

export function useMatches(options = {}) {
  return useQuery({
    queryKey: qk.matches,
    queryFn: getMatches,
    ...options, // låt komponenter override:a staleTime osv vid behov
  });
}

export function useMatch(id, options = {}) {
  return useQuery({
    queryKey: qk.match(id),
    queryFn: () => getMatchById(id),
    enabled: !!id,
    ...options,
  });
}

export function useUserMatches(options = {}) {
  return useQuery({
    queryKey: qk.userMatches,
    queryFn: getUserMatches,
    ...options,
  });
}

export function useOfficialMatches(options = {}) {
  return useQuery({
    queryKey: qk.officialMatches,
    queryFn: getOfficialMatches,
    ...options,
  });
}

// --- Mutationer (skriv) ---

// Skapa match från officiell
export function useCreateFromOfficial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (official_match_id) => createFromOfficial(official_match_id),
    onSuccess: () => {
      // Hämta om listor som påverkas
      qc.invalidateQueries({ queryKey: qk.matches });
      qc.invalidateQueries({ queryKey: qk.userMatches });
      // om din UI visar official list för att skapa – fräscha den också
      qc.invalidateQueries({ queryKey: qk.officialMatches });
    },
  });
}

// Bekräfta match
export function useConfirmMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => confirmMatch(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.match(id) });
      qc.invalidateQueries({ queryKey: qk.matches });
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}

// Radera match
export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteMatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.matches });
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}

// Radera user-match (vanlig)
export function useDeleteUserMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userMatchId) => deleteUserMatch(userMatchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}

// Radera user-match (cascade)
export function useDeleteUserMatchCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userMatchId) => deleteUserMatchCascade(userMatchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.userMatches });
      qc.invalidateQueries({ queryKey: qk.matches });
    },
  });
}

// Lösa user-match (approve/decline etc.)
export function useResolveUserMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userMatchId, action }) => resolveUserMatch(userMatchId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}

// Heat-resultat
export function useClearHeatResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, heatNumber }) => clearHeatResults(matchId, heatNumber),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: qk.match(matchId) });
      qc.invalidateQueries({ queryKey: qk.matches });
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}

export function usePutHeatResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, heatNumber, results }) =>
      putHeatResults(matchId, heatNumber, results),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: qk.match(matchId) });
      qc.invalidateQueries({ queryKey: qk.matches });
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}

export function useUpdateHeatRiders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, heatNumber, assignments }) =>
      updateHeatRiders(matchId, heatNumber, assignments),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: qk.match(matchId) });
      qc.invalidateQueries({ queryKey: qk.matches });
      qc.invalidateQueries({ queryKey: qk.userMatches });
    },
  });
}
