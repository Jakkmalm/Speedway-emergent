// src/queries/account.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getAccount, updateProfile, changePassword,
    getNotifications, updateNotifications,
    getSessions, revokeSession, revokeAllOtherSessions,
    startEnable2FA, verify2FA, disable2FA,
    exportMyData, deleteAccount,
} from "@/api/account";

export const qk = {
    account: ["account"],
    notifications: ["notifications"],
    sessions: ["sessions"],
};

export function useAccount(options = {}) {
    return useQuery({
        queryKey: qk.account,
        queryFn: getAccount,
        staleTime: Infinity,
        ...options,
    });
}

export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updateProfile,
        onMutate: async (patch) => {
            await qc.cancelQueries({ queryKey: qk.account });
            const prev = qc.getQueryData(qk.account);
            qc.setQueryData(qk.account, (old) => ({ ...(old || {}), ...(patch || {}) }));
            return { prev };
        },
        onError: (_e, _vars, ctx) => {
            if (ctx?.prev) qc.setQueryData(qk.account, ctx.prev);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: qk.account });
        },
    });
}

export function useChangePassword() {
    return useMutation({ mutationFn: changePassword });
}

export function useNotifications(options = {}) {
    return useQuery({
        queryKey: qk.notifications,
        queryFn: getNotifications,
        staleTime: Infinity,
        ...options,
    });
}

export function useUpdateNotifications() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updateNotifications,
        onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
    });
}

export function useSessions(options = {}) {
    return useQuery({
        queryKey: qk.sessions,
        queryFn: getSessions,
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

export function useRevokeSession() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: revokeSession,
        onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
    });
}

export function useRevokeAllOtherSessions() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: revokeAllOtherSessions,
        onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
    });
}

export function useStartEnable2FA() {
    return useMutation({ mutationFn: startEnable2FA });
}
export function useVerify2FA() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: verify2FA,
        onSuccess: () => qc.invalidateQueries({ queryKey: qk.account }),
    });
}
export function useDisable2FA() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: disable2FA,
        onSuccess: () => qc.invalidateQueries({ queryKey: qk.account }),
    });
}

export function useExportMyData() {
    return useMutation({ mutationFn: exportMyData });
}

export function useDeleteAccount() {
    return useMutation({ mutationFn: deleteAccount });
}
