// // // src/components/Header.jsx

// // src/components/Header.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { NavLink, useLocation, useParams } from "react-router-dom";
// import { Trophy } from "lucide-react";
// import { Button } from "./ui/button";
// import { useAuth } from "../contexts/AuthContext";

// function classNames(...xs) {
//   return xs.filter(Boolean).join(" ");
// }

// export default function Header() {
//   const { user, logout } = useAuth();
//   const location = useLocation();
//   const params = useParams(); // läser /match/:id om vi är där
//   const [open, setOpen] = useState(false);
//   const [storedActiveMatchId, setStoredActiveMatchId] = useState(null);

//   // läs ev. tidigare aktiv match från localStorage
//   useEffect(() => {
//     const m = localStorage.getItem("active_match_id");
//     setStoredActiveMatchId(m || null);
//   }, [location.pathname]);

//   // aktiv match-id: från URL i första hand, annars från storage
//   const activeMatchId = useMemo(
//     () => params?.id || storedActiveMatchId,
//     [params?.id, storedActiveMatchId]
//   );

//   const nav = [
//     { to: "/", label: "Tabell", show: true },
//     { to: "/matches", label: "Matcher", show: true },
//     // Protokoll syns bara om vi vet en aktiv match
//     {
//       to: activeMatchId ? `/match/${activeMatchId}` : "/matches",
//       label: "Protokoll",
//       show: !!activeMatchId,
//     },
//     { to: "/my-matches", label: "Mina matcher", show: !!user },
//   ];

//   return (
//     <header className="bg-white shadow-lg border-b-4 border-red-600 sticky top-0 z-40">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="h-16 flex items-center justify-between">
//           {/* Brand */}
//           <NavLink to="/" className="flex items-center space-x-3">
//             <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
//               <Trophy className="h-6 w-6 text-white" />
//             </div>
//             <div className="hidden sm:block">
//               <div className="text-lg font-bold text-gray-900">
//                 Speedway Elitserien
//               </div>
//               <div className="text-xs text-gray-500 -mt-0.5">
//                 Professionellt Matchprotokoll
//               </div>
//             </div>
//           </NavLink>

//           {/* Desktop nav */}
//           <nav className="hidden md:flex items-center gap-1">
//             {nav
//               .filter((n) => n.show)
//               .map((n) => (
//                 <NavLink
//                   key={n.to + n.label}
//                   to={n.to}
//                   className={({ isActive }) =>
//                     classNames(
//                       "px-3 py-2 rounded-md text-sm font-medium transition",
//                       isActive
//                         ? "bg-red-600 text-white"
//                         : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
//                     )
//                   }
//                 >
//                   {n.label}
//                 </NavLink>
//               ))}
//           </nav>

//           {/* Auth */}
//           <div className="hidden md:flex items-center gap-3">
//             {user ? (
//               <>
//                 <span className="text-sm text-gray-700">
//                   Hej, <b>{user.username}</b>
//                 </span>
//                 <Button variant="outline" onClick={logout}>
//                   Logga ut
//                 </Button>
//               </>
//             ) : (
//               // Låt /auth vara ingången
//               <NavLink to="/auth">
//                 <Button className="bg-red-600 hover:bg-red-700">
//                   Logga in
//                 </Button>
//               </NavLink>
//             )}
//           </div>

//           {/* Mobile menu button */}
//           <button
//             className="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100"
//             onClick={() => setOpen(!open)}
//             aria-label="Open menu"
//           >
//             <svg
//               className="h-6 w-6 text-gray-800"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//             >
//               {open ? (
//                 <path
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   d="M6 18L18 6M6 6l12 12"
//                 />
//               ) : (
//                 <path
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   d="M4 6h16M4 12h16M4 18h16"
//                 />
//               )}
//             </svg>
//           </button>
//         </div>
//       </div>

//       {/* Mobile nav */}
//       {open && (
//         <div className="md:hidden border-t bg-white">
//           <div className="px-4 py-3 space-y-2">
//             {nav
//               .filter((n) => n.show)
//               .map((n) => (
//                 <NavLink
//                   key={n.to + n.label}
//                   to={n.to}
//                   onClick={() => setOpen(false)}
//                   className={({ isActive }) =>
//                     classNames(
//                       "block px-3 py-2 rounded-md text-sm font-medium transition",
//                       isActive
//                         ? "bg-red-600 text-white"
//                         : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
//                     )
//                   }
//                 >
//                   {n.label}
//                 </NavLink>
//               ))}

//             <div className="pt-2 border-t">
//               {user ? (
//                 <div className="flex items-center justify-between">
//                   <span className="text-sm text-gray-700">
//                     Inloggad som <b>{user.username}</b>
//                   </span>
//                   <Button variant="outline" size="sm" onClick={logout}>
//                     Logga ut
//                   </Button>
//                 </div>
//               ) : (
//                 <NavLink to="/auth" onClick={() => setOpen(false)}>
//                   <Button className="w-full mt-2 bg-red-600 hover:bg-red-700">
//                     Logga in
//                   </Button>
//                 </NavLink>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </header>
//   );
// }


// src/components/Header.jsx
import React, { useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Kolla om vi är på /match/:id
  const matchRoute = useMatch("/match/:id");
  const activeMatchId = matchRoute?.params?.id || null;

  const nav = [
    { to: "/", label: "Tabell", show: true },
    { to: "/matches", label: "Matcher", show: true },
    // Visa Protokoll endast när vi faktiskt är på en match-route
    { to: activeMatchId ? `/match/${activeMatchId}` : "/matches", label: "Protokoll", show: !!activeMatchId },
    { to: "/my-matches", label: "Mina matcher", show: !!user },
  ];

  const handleLogout = () => {
    logout();
    navigate("/auth", { replace: true });
  };

  return (
    <header className="bg-white shadow-lg border-b-4 border-red-600 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Brand */}
          <NavLink to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-bold text-gray-900">Speedway Elitserien</div>
              <div className="text-xs text-gray-500 -mt-0.5">Professionellt Matchprotokoll</div>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.filter(n => n.show).map(n => (
              <NavLink
                key={n.to + n.label}
                to={n.to}
                className={({ isActive }) =>
                  cx(
                    "px-3 py-2 rounded-md text-sm font-medium transition",
                    isActive ? "bg-red-600 text-white" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* Auth (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-700">
                  Hej, <b>{user.username}</b>
                </span>
                <Button variant="outline" onClick={handleLogout}>
                  Logga ut
                </Button>
              </>
            ) : (
              <NavLink to="/auth">
                <Button className="bg-red-600 hover:bg-red-700">Logga in</Button>
              </NavLink>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100"
            onClick={() => setOpen(o => !o)}
            aria-label="Open menu"
          >
            <svg className="h-6 w-6 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {open ? (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-3 space-y-2">
            {nav.filter(n => n.show).map(n => (
              <NavLink
                key={n.to + n.label}
                to={n.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cx(
                    "block px-3 py-2 rounded-md text-sm font-medium transition",
                    isActive ? "bg-red-600 text-white" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}

            <div className="pt-2 border-t">
              {user ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Inloggad som <b>{user.username}</b>
                  </span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Logga ut
                  </Button>
                </div>
              ) : (
                <NavLink to="/auth" onClick={() => setOpen(false)}>
                  <Button className="w-full mt-2 bg-red-600 hover:bg-red-700">Logga in</Button>
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
