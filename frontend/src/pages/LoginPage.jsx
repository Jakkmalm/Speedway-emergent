// // src/pages/LoginPage.jsx
// import React, { useState } from "react";
// import { apiCall } from "@/api/client";
// import { useNavigate } from "react-router-dom";

// export default function LoginPage() {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [busy, setBusy] = useState(false);
//   const navigate = useNavigate();

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     setBusy(true);
//     try {
//       const res = await apiCall("/api/auth/login", {
//         method: "POST",
//         body: JSON.stringify({ username, password }),
//       });
//       if (!res?.token) throw new Error("Inget token i svaret.");

//       localStorage.setItem("speedway_token", res.token);
//       localStorage.setItem(
//         "speedway_user",
//         JSON.stringify(res.user || { username })
//       );
//       navigate("/matches"); // vidare in i appen
//     } catch (err) {
//       alert(err.message || "Inloggning misslyckades.");
//     } finally {
//       setBusy(false);
//     }
//   };

//   return (
//     <div className="max-w-sm mx-auto p-6">
//       <h1 className="text-xl font-bold mb-4">Logga in</h1>
//       <form onSubmit={onSubmit} className="space-y-3">
//         <input
//           className="w-full border rounded px-3 py-2"
//           placeholder="Användarnamn"
//           value={username}
//           onChange={(e) => setUsername(e.target.value)}
//           required
//         />
//         <input
//           className="w-full border rounded px-3 py-2"
//           placeholder="Lösenord"
//           type="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//         />
//         <button
//           className="w-full bg-red-600 text-white rounded py-2 disabled:opacity-60"
//           type="submit"
//           disabled={busy}
//         >
//           {busy ? "Loggar in…" : "Logga in"}
//         </button>
//       </form>
//     </div>
//   );
// }
