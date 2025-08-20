// src/pages/MyAccountPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "../components/ui/button";


export default function MyAccountPage() {

  const { theme, setTheme } = useTheme();


  return (
    <div className="max-w-5xl mx-auto p-6 grid gap-6 md:grid-cols-2">
      <p>SÅLÄNGE-KNAPP</p>
      <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        Byt tema
      </Button>
      {/* Konto-information */}
      <Link
        to="/account/settings"
        className="rounded-2xl border bg-card shadow hover:shadow-md transition p-6 flex flex-col gap-1"
      >
        <h2 className="text-lg font-semibold">👤 Kontoinformation</h2>
        <p className="text-sm text-muted-foreground">
          Ändra användarnamn, e-post eller lösenord.
        </p>
      </Link>

      {/* Notisinställningar */}
      <Link
        to="/account/notifications"
        className="rounded-2xl border bg-card shadow hover:shadow-md transition p-6 flex flex-col gap-1"
      >
        <h2 className="text-lg font-semibold">🔔 Notisinställningar</h2>
        <p className="text-sm text-muted-foreground">
          Hantera push- och e-postnotiser.
        </p>
      </Link>
    </div>
  );
}
