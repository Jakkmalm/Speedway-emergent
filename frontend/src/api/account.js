// src/api/account.js
import { apiCall, API_BASE_URL } from "@/api/client";

// ====== Profil / konto ======
export const getAccount = () => apiCall("/api/account/me");

export const updateProfile = (payload) =>
    apiCall("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify(payload), // { display_name, username, email, preferences? }
    });

export const changePassword = ({ current_password, new_password }) =>
    apiCall("/api/account/password", {
        method: "PUT",
        body: JSON.stringify({ current_password, new_password }),
    });

// ====== Notiser ======
export const getNotifications = () => apiCall("/api/account/notifications");

export const updateNotifications = (payload) =>
    apiCall("/api/account/notifications", {
        method: "PUT",
        body: JSON.stringify(payload), // t.ex. { email: {...}, push: {...}, quietHours: {...} }
    });

// ====== Sessioner / enheter ======
export const getSessions = () => apiCall("/api/account/sessions");

export const revokeSession = (sessionId) =>
    apiCall(`/api/account/sessions/${sessionId}`, { method: "DELETE" });

export const revokeAllOtherSessions = () =>
    apiCall(`/api/account/sessions`, {
        method: "DELETE",
        body: JSON.stringify({ scope: "others" }),
    });

// ====== 2FA ======
export const startEnable2FA = () =>
    apiCall("/api/account/2fa/enable", { method: "POST" }); // -> { otpauth_url, secret, qrcodeDataUrl? }

export const verify2FA = (code) =>
    apiCall("/api/account/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
    });

export const disable2FA = () =>
    apiCall("/api/account/2fa/disable", { method: "POST" });

// ====== Export / Delete ======
export const exportMyData = async () => {
    const token = localStorage.getItem("speedway_token");
    const res = await fetch(`${API_BASE_URL}/api/account/export`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error("Kunde inte exportera data");
    const blob = await res.blob();
    return blob; // låt komponenten ladda ned
};

export const deleteAccount = ({ password }) =>
    apiCall("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
    });
