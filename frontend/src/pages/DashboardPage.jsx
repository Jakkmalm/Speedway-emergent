// src/pages/DashboardPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flag, FileText, Calendar } from "lucide-react";

function DashboardCard({ to, title, description, icon }) {
  return (
    <Link
      to={to}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
    >
      <Card className="rounded-2xl bg-card shadow-sm border transition hover:shadow-md hover:border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
      <DashboardCard
        to="/matches"
        title="Starta match"
        description="Skapa och administrera en ny match."
        icon={<Flag className="w-5 h-5 text-primary" />}
      />
      <DashboardCard
        to="/my-matches"
        title="Mina protokoll"
        description="Se pågående eller tidigare sparade protokoll."
        icon={<FileText className="w-5 h-5 text-primary" />}
      />
      <DashboardCard
        to="/matches"
        title="Kommande matcher"
        description="Ta del av nästa omgång i Elitserien."
        icon={<Calendar className="w-5 h-5 text-primary" />}
      />
    </div>
  );
}
