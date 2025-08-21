// src/layouts/RootLayout.jsx
import React from "react";
import Header from "@/components/Header";
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Users, Calendar, Target } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";



export default function RootLayout() {
  const { user, logout } = useAuth();

  const navLink = "px-3 py-2 rounded hover:bg-gray-100 text-sm font-medium";
  const navLinkActive = ({ isActive }) =>
    `${navLink} ${isActive ? "bg-gray-200" : ""}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-black">
      {/* Header / meny */}
      <Header />

      {/* Sidinnehåll */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs />

        {/* Navigering */}
        <Outlet />
      </main>
    </div>
  );
}
