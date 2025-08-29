// src/App.jsx
import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "next-themes";

import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import MatchesPage from "./pages/MatchesPage";
import MatchProtocolPage from "./pages/MatchProtocolPage";
import MyMatchesPage from "./pages/MyMatchesPage";
import NotFoundPage from "./pages/NotFoundPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import RequireAuth from "./components/RequireAuth";
import MyAccountPage from "./pages/MyAccountPage";

import { AuthProvider } from "./contexts/AuthContext";

import AccountPage from "@/pages/account/AccountPage";
import ProfilePage from "@/pages/account/ProfilePage";
import AppearancePage from "@/pages/account/AppearancePage";
import NotificationsPage from "@/pages/account/NotificationsPage";
import SecurityPage from "@/pages/account/SecurityPage";
import PrivacyPage from "@/pages/account/PrivacyPage";

import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <Suspense fallback={<div className="p-6">Laddar…</div>}>
          <Router>
            <Routes>
              {/* Öppen route för inlogg/registrering */}
              <Route path="/auth" element={<AuthPage />} />

              {/* Skyddade routes: kräver inloggning */}
              {/* <Route
                element={
                  <RequireAuth>
                    <RootLayout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/match/:id" element={<MatchProtocolPage />} />
                <Route path="/my-matches" element={<MyMatchesPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route> */}
              <Route
                element={
                  <RequireAuth>
                    <RootLayout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* /account som layout + undersidor */}
                <Route path="/account" element={<AccountPage />}>
                  <Route index element={<ProfilePage />} />
                  <Route path="appearance" element={<AppearancePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="security" element={<SecurityPage />} />
                  <Route path="privacy" element={<PrivacyPage />} />
                </Route>

                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/match/:id" element={<MatchProtocolPage />} />
                <Route path="/my-matches" element={<MyMatchesPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
            {/* 2. Lägg till Toaster-komponenten här */}
            <Toaster position="top-center"
              toastOptions={{
                // Här lägger vi till anpassad styling
                classNames: {
                  toast: 'bg-zinc-900 border-zinc-700 shadow-lg', // Generell stil för alla toasts
                  title: 'text-white text-base',                  // Stil för titeln
                  description: 'text-zinc-400',                   // Stil för beskrivningen
                  actionButton: 'bg-indigo-600 text-white',       // Stil för en action-knapp

                  // Du kan även styla specifika typer
                  success: 'border-green-500 text-white',
                  error: 'bg-red-950 border-red-700 text-red-100',
                },
              }} />
          </Router>
        </Suspense>
      </AuthProvider>
    </ThemeProvider>
  );
}
