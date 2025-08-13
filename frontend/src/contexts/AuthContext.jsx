// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiCall } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // ← nytt

  useEffect(() => {
    const u = localStorage.getItem("speedway_user");
    if (u) {
      try {
        setUser(JSON.parse(u));
      } catch {}
    }
    setReady(true); // ← vi är klara med initial load
  }, []);

  // useEffect(() => {
  //   try {
  //     const raw = localStorage.getItem("speedway_user");
  //     if (raw) {
  //       const parsed = JSON.parse(raw);
  //       setUser(parsed);
  //       migrateLegacyActiveMatch(parsed?.id);
  //     }
  //   } catch {}
  //   setReady(true); // <— nu vet vi om det finns user eller ej
  // }, []);

  const login = async (username, password) => {
    const res = await apiCall("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem("speedway_token", res.token);
    localStorage.setItem("speedway_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user; // <- returnera användaren
  };

  const register = async (username, email, password) => {
    const res = await apiCall("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    localStorage.setItem("speedway_token", res.token);
    localStorage.setItem("speedway_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user; // <- returnera användaren
  };

  const logout = () => {
    // rensa ALLA aktiva-nycklar (oavsett vem som var inloggad)
    localStorage.removeItem("speedway_token");
    localStorage.removeItem("speedway_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
