// src/components/RequireAuth.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) {
    return <div className="p-6">Laddar…</div>;
  }
  
  if (!user) {
    const redirectTo = encodeURIComponent(loc.pathname + loc.search);
    // return <Navigate to={`/auth?redirectTo=${redirectTo}`} replace />;
    return <Navigate to="/auth" replace />
  }

  // När RootLayout skickas in som child:
  return children ? children : <Outlet />;
}
