import React from "react";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 grid gap-6 md:grid-cols-3">
      {/* Starta match */}
      <Link
        to="/matches"
        className="rounded-2xl border bg-card shadow hover:shadow-md transition p-6 flex flex-col gap-1"
      >
        <h2 className="text-lg font-semibold">🏁 Starta match</h2>
        <p className="text-sm text-muted-foreground">
          Skapa och administrera en ny match.
        </p>
      </Link>

      {/* Mina protokoll */}
      <Link
        to="/my-matches"
        className="rounded-2xl border bg-card shadow hover:shadow-md transition p-6 flex flex-col gap-1"
      >
        <h2 className="text-lg font-semibold">📄 Mina protokoll</h2>
        <p className="text-sm text-muted-foreground">
          Se pågående eller tidigare sparade protokoll.
        </p>
      </Link>

      {/* Kommande matcher */}
      <Link
        to="/matches"
        className="rounded-2xl border bg-card shadow hover:shadow-md transition p-6 flex flex-col gap-1"
      >
        <h2 className="text-lg font-semibold">📅 Kommande matcher</h2>
        <p className="text-sm text-muted-foreground">
          Ta del av nästa omgång i Elitserien.
        </p>
      </Link>
    </div>
  );
}
