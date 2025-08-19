// src/App.jsx
import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import MatchesPage from "./pages/MatchesPage";
import MatchProtocolPage from "./pages/MatchProtocolPage";
import MyMatchesPage from "./pages/MyMatchesPage";
import NotFoundPage from "./pages/NotFoundPage";
import AuthPage from "./pages/AuthPage";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./contexts/AuthContext";

import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="p-6">Laddar…</div>}>
        <Router>
          <Routes>
            {/* Öppen route för inlogg/registrering */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Skyddade routes: kräver inloggning */}
            <Route
              element={
                <RequireAuth>
                  <RootLayout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/match/:id" element={<MatchProtocolPage />} />
              <Route path="/my-matches" element={<MyMatchesPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          {/* 2. Lägg till Toaster-komponenten här */}
          <Toaster richColors position="top-right" />
        </Router>
      </Suspense>
    </AuthProvider>
  );
}
