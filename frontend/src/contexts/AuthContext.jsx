// // src/contexts/AuthContext.jsx
// import React, { createContext, useContext, useEffect, useState } from "react";
// import { apiCall } from "../api/client";

// const AuthContext = createContext(null);

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(null);
//   const [ready, setReady] = useState(false); // ← nytt

//   useEffect(() => {
//     const u = localStorage.getItem("speedway_user");
//     if (u) {
//       try {
//         setUser(JSON.parse(u));
//       } catch {}
//     }
//     setReady(true); // ← vi är klara med initial load
//   }, []);


//   const login = async (username, password) => {
//     const res = await apiCall("/api/auth/login", {
//       method: "POST",
//       body: JSON.stringify({ username, password }),
//     });
//     localStorage.setItem("speedway_token", res.token);
//     localStorage.setItem("speedway_user", JSON.stringify(res.user));
//     setUser(res.user);
//     return res.user; // <- returnera användaren
//   };

//   const register = async (username, email, password) => {
//     const res = await apiCall("/api/auth/register", {
//       method: "POST",
//       body: JSON.stringify({ username, email, password }),
//     });
//     localStorage.setItem("speedway_token", res.token);
//     localStorage.setItem("speedway_user", JSON.stringify(res.user));
//     setUser(res.user);
//     return res.user; // <- returnera användaren
//   };

//   const logout = () => {
//     // rensa ALLA aktiva-nycklar (oavsett vem som var inloggad)
//     localStorage.removeItem("speedway_token");
//     localStorage.removeItem("speedway_user");
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, ready, login, register, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export const useAuth = () => useContext(AuthContext);

// // src/contexts/AuthContext.jsx
// import React, { createContext, useContext, useEffect, useState } from "react";
// import { apiCall } from "../api/client";
// import { useQueryClient } from "@tanstack/react-query";

// const AuthContext = createContext(null);

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(null);
//   const [ready, setReady] = useState(false);
//   const queryClient = useQueryClient();
//   const [authVersion, setAuthVersion] = useState(0); // bumpas vid login/logout

//   useEffect(() => {
//     const u = localStorage.getItem("speedway_user");
//     if (u) {
//       try { setUser(JSON.parse(u)); } catch { }
//     }
//     setReady(true);
//   }, []);

//   // STEG 1: login → kan returnera token ELLER 2FA-biljett
//   const login = async (username, password) => {
//     const res = await apiCall("/api/auth/login", {
//       method: "POST",
//       body: JSON.stringify({ username, password }),
//     });

//     // 2FA krävs: lagra inte token ännu – returnera data till UI:t
//     if (res?.two_factor_required) {
//       return {
//         twoFactorRequired: true,
//         ticket: res.ticket,
//         deviceLabel: res.device_label || "Ny enhet",
//         user: res.user, // valfritt att visa namn i UI:t
//       };
//     }

//     // Ingen 2FA: spara token + user direkt
//     if (res?.token && res?.user) {
//       localStorage.setItem("speedway_token", res.token);
//       localStorage.setItem("speedway_user", JSON.stringify(res.user));
//       setUser(res.user);
//       return { ok: true, user: res.user };
//     }

//     throw new Error("Oväntat svar från servern vid inloggning.");
//   };

//   // STEG 2: verifiera 2FA-kod → då får vi token + user
//   const verify2FA = async (ticket, code) => {
//     const res = await apiCall("/api/auth/2fa/verify", {
//       method: "POST",
//       body: JSON.stringify({ ticket, code }),
//     });

//     if (res?.token && res?.user) {
//       localStorage.setItem("speedway_token", res.token);
//       localStorage.setItem("speedway_user", JSON.stringify(res.user));
//       setUser(res.user);
//       return { ok: true, user: res.user };
//     }

//     throw new Error("Oväntat svar från servern vid 2FA-verifiering.");
//   };

//   const register = async (username, email, password) => {
//     const res = await apiCall("/api/auth/register", {
//       method: "POST",
//       body: JSON.stringify({ username, email, password }),
//     });
//     localStorage.setItem("speedway_token", res.token);
//     localStorage.setItem("speedway_user", JSON.stringify(res.user));
//     setUser(res.user);
//     return res.user;
//   };

//   const logout = () => {
//     localStorage.removeItem("speedway_token");
//     localStorage.removeItem("speedway_user");
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, ready, login, verify2FA, register, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export const useAuth = () => useContext(AuthContext);


// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiCall } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  // bumpas vid login/logout (och när 2FA blir klar) för att invalidatera user-scoped queries
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const u = localStorage.getItem("speedway_user");
    if (u) {
      try { setUser(JSON.parse(u)); } catch { }
    }
    setReady(true);
  }, []);

  // Håll alla flikar i synk: om token/user tas bort i EN flik → logga ut i denna också  TESTAR
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "speedway_token" || e.key === "speedway_user") {
        const token = localStorage.getItem("speedway_token");
        const u = localStorage.getItem("speedway_user");
        if (!token || !u) {
          setUser(null);
          // Om man står på skyddad sida så tar RequireAuth över och skickar till /auth
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 🆕 Lyssna på global "auth:logout" → nolla user och töm cache
  useEffect(() => {
    const onForcedLogout = () => {
      setUser(null);
      try { queryClient.clear(); } catch { }
    };
    window.addEventListener("auth:logout", onForcedLogout);
    return () => window.removeEventListener("auth:logout", onForcedLogout);
  }, [queryClient]);






  // // STEG 1: login → kan returnera token ELLER 2FA-biljett
  // const login = async (username, password) => {
  //   const res = await apiCall("/api/auth/login", {
  //     method: "POST",
  //     body: JSON.stringify({ username, password }),
  //   });

  //   // 2FA krävs: lagra inte token ännu – returnera data till UI:t
  //   if (res?.two_factor_required) {
  //     return {
  //       twoFactorRequired: true,
  //       ticket: res.ticket,
  //       deviceLabel: res.device_label || "Ny enhet",
  //       user: res.user,
  //     };
  //   }

  //   // Ingen 2FA: spara token + user direkt
  //   if (res?.token && res?.user) {
  //     localStorage.setItem("speedway_token", res.token);
  //     localStorage.setItem("speedway_user", JSON.stringify(res.user));
  //     setUser(res.user);

  //     // Rensa all cache när identitet ändras
  //     queryClient.clear();
  //     setAuthVersion(v => v + 1);

  //     return { ok: true, user: res.user };
  //   }

  //   throw new Error("Oväntat svar från servern vid inloggning.");
  // };

  const login = async (username, password) => {
    const res = await apiCall("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (res?.two_factor_required) {
      return {
        twoFactorRequired: true,
        ticket: res.ticket,
        deviceLabel: res.device_label || "Ny enhet",
        user: res.user,
      };
    }

    if (res?.token && res?.user) {
      localStorage.setItem("speedway_token", res.token);
      localStorage.setItem("speedway_user", JSON.stringify(res.user));
      setUser(res.user);
      return { ok: true, user: res.user };
    }

    throw new Error("Oväntat svar från servern vid inloggning.");
  };

  // STEG 2: verifiera 2FA-kod → då får vi token + user
  // const verify2FA = async (ticket, code) => {
  //   const res = await apiCall("/api/auth/2fa/verify", {
  //     method: "POST",
  //     body: JSON.stringify({ ticket, code }),
  //   });

  //   if (res?.token && res?.user) {
  //     localStorage.setItem("speedway_token", res.token);
  //     localStorage.setItem("speedway_user", JSON.stringify(res.user));
  //     setUser(res.user);

  //     // Rensa cache nu när vi blev “riktigt” inloggade
  //     queryClient.clear();
  //     setAuthVersion(v => v + 1);

  //     return { ok: true, user: res.user };
  //   }

  //   throw new Error("Oväntat svar från servern vid 2FA-verifiering.");
  // };

  const verify2FA = async (ticket, code) => {
    const res = await apiCall("/api/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ ticket, code }),
    });
    if (res?.token && res?.user) {
      localStorage.setItem("speedway_token", res.token);
      localStorage.setItem("speedway_user", JSON.stringify(res.user));
      setUser(res.user);
      return { ok: true, user: res.user };
    }
    throw new Error("Oväntat svar från servern vid 2FA-verifiering.");
  };

  // const register = async (username, email, password) => {
  //   const res = await apiCall("/api/auth/register", {
  //     method: "POST",
  //     body: JSON.stringify({ username, email, password }),
  //   });

  //   localStorage.setItem("speedway_token", res.token);
  //   localStorage.setItem("speedway_user", JSON.stringify(res.user));
  //   setUser(res.user);

  //   queryClient.clear();
  //   setAuthVersion(v => v + 1);

  //   return res.user;
  // };

  const register = async (username, email, password) => {
    const res = await apiCall("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    localStorage.setItem("speedway_token", res.token);
    localStorage.setItem("speedway_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  // const logout = () => {
  //   localStorage.removeItem("speedway_token");
  //   localStorage.removeItem("speedway_user");
  //   setUser(null);

  //   // Viktigt: blås bort alla user-specifika queries
  //   queryClient.clear();
  //   setAuthVersion(v => v + 1);
  // };

  const logout = () => {
    try {
      localStorage.removeItem("speedway_token");
      localStorage.removeItem("speedway_user");
    } catch { }
    // 🆕 Visa trevlig toast på /auth efter redirect
    sessionStorage.setItem("auth_notice", "Du har loggats ut.");
    setUser(null);
    try { queryClient.clear(); } catch { }
    // 🆕 Sänd samma event som vid 401 så allt beter sig lika
    try {
      window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "manual" } }));
    } catch { }
  };

  return (
    <AuthContext.Provider value={{ user, ready, authVersion, login, verify2FA, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


