// // src/queries/account.js
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import {
//     getAccount, updateProfile, changePassword,
//     getNotifications, updateNotifications,
//     getSessions, revokeSession, revokeAllOtherSessions,
//     startEnable2FA, verify2FA, disable2FA,
//     exportMyData, deleteAccount,
// } from "@/api/account";

// export const qk = {
//     account: ["account"],
//     notifications: ["notifications"],
//     sessions: ["sessions"],
// };

// export function useAccount(options = {}) {
//     return useQuery({
//         queryKey: qk.account,
//         queryFn: getAccount,
//         staleTime: Infinity,
//         ...options,
//     });
// }

// export function useUpdateProfile() {
//     const qc = useQueryClient();
//     return useMutation({
//         mutationFn: updateProfile,
//         onMutate: async (patch) => {
//             await qc.cancelQueries({ queryKey: qk.account });
//             const prev = qc.getQueryData(qk.account);
//             qc.setQueryData(qk.account, (old) => ({ ...(old || {}), ...(patch || {}) }));
//             return { prev };
//         },
//         onError: (_e, _vars, ctx) => {
//             if (ctx?.prev) qc.setQueryData(qk.account, ctx.prev);
//         },
//         onSettled: () => {
//             qc.invalidateQueries({ queryKey: qk.account });
//         },
//     });
// }

// export function useChangePassword() {
//     return useMutation({ mutationFn: changePassword });
// }

// export function useNotifications(options = {}) {
//     return useQuery({
//         queryKey: qk.notifications,
//         queryFn: getNotifications,
//         staleTime: Infinity,
//         ...options,
//     });
// }

// export function useUpdateNotifications() {
//     const qc = useQueryClient();
//     return useMutation({
//         mutationFn: updateNotifications,
//         onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
//     });
// }

// export function useSessions(options = {}) {
//     return useQuery({
//         queryKey: qk.sessions,
//         queryFn: getSessions,
//         staleTime: 5 * 60 * 1000,
//         ...options,
//     });
// }

// export function useRevokeSession() {
//     const qc = useQueryClient();
//     return useMutation({
//         mutationFn: revokeSession,
//         onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
//     });
// }

// export function useRevokeAllOtherSessions() {
//     const qc = useQueryClient();
//     return useMutation({
//         mutationFn: revokeAllOtherSessions,
//         onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
//     });
// }

// export function useStartEnable2FA() {
//     return useMutation({ mutationFn: startEnable2FA });
// }
// export function useVerify2FA() {
//     const qc = useQueryClient();
//     return useMutation({
//         mutationFn: verify2FA,
//         onSuccess: () => qc.invalidateQueries({ queryKey: qk.account }),
//     });
// }
// export function useDisable2FA() {
//     const qc = useQueryClient();
//     return useMutation({
//         mutationFn: disable2FA,
//         onSuccess: () => qc.invalidateQueries({ queryKey: qk.account }),
//     });
// }

// export function useExportMyData() {
//     return useMutation({ mutationFn: exportMyData });
// }

// export function useDeleteAccount() {
//     return useMutation({ mutationFn: deleteAccount });
// }


// src/queries/account.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAccount, updateProfile, changePassword,
  getNotifications, updateNotifications,
  getSessions, revokeSession, revokeAllOtherSessions,
  startEnable2FA, verify2FA, disable2FA,
  exportMyData, deleteAccount,
} from "@/api/account";

// Query Keys: funktioner så vi kan nyckla på userId + authVersion
export const qk = {
  account: (uid, v) => ["account", uid, v],
  notifications: (uid, v) => ["notifications", uid, v],
  sessions: (uid, v) => ["sessions", uid, v],
};

export function useAccount(options = {}) {
  const { user, authVersion } = useAuth();
  return useQuery({
    queryKey: qk.account(user?.id, authVersion),
    queryFn: getAccount,
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
    ...options,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user, authVersion } = useAuth();
  const key = qk.account(user?.id, authVersion);

  return useMutation({
    mutationFn: updateProfile,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => ({ ...(old || {}), ...(patch || {}) }));
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword });
}

export function useNotifications(options = {}) {
  const { user, authVersion } = useAuth();
  return useQuery({
    queryKey: qk.notifications(user?.id, authVersion),
    queryFn: getNotifications,
    enabled: !!user,
    // välj kort cache om du vill:
    staleTime: 0,
    ...options,
  });
}

export function useUpdateNotifications() {
  const qc = useQueryClient();
  const { user, authVersion } = useAuth();
  const key = qk.notifications(user?.id, authVersion);

  return useMutation({
    mutationFn: updateNotifications,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useSessions(options = {}) {
  const { user, authVersion } = useAuth();
  return useQuery({
    queryKey: qk.sessions(user?.id, authVersion),
    queryFn: getSessions,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  const { user, authVersion } = useAuth();
  const key = qk.sessions(user?.id, authVersion);

  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      // valfritt: uppdatera även konto om du visar sessionsstatistik där
      qc.invalidateQueries({ queryKey: qk.account(user?.id, authVersion) });
    },
  });
}

export function useRevokeAllOtherSessions() {
  const qc = useQueryClient();
  const { user, authVersion } = useAuth();
  const key = qk.sessions(user?.id, authVersion);

  return useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qk.account(user?.id, authVersion) });
    },
  });
}

export function useStartEnable2FA() {
  return useMutation({ mutationFn: startEnable2FA });
}

export function useVerify2FA() {
  const qc = useQueryClient();
  const { user, authVersion } = useAuth();
  const key = qk.account(user?.id, authVersion);

  return useMutation({
    mutationFn: verify2FA,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDisable2FA() {
  const qc = useQueryClient();
  const { user, authVersion } = useAuth();
  const key = qk.account(user?.id, authVersion);

  return useMutation({
    mutationFn: disable2FA,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useExportMyData() {
  return useMutation({ mutationFn: exportMyData });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}
