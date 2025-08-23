// src/pages/MyAccountPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { User, Bell, Palette } from "lucide-react";

function AccountCard({ to, title, description, icon }) {
  return (
    <Link
      to={to}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
    >
      <Card className="rounded-2xl bg-card border shadow-sm transition hover:shadow-md hover:border-primary/40 hover:bg-accent/40">
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

export default function MyAccountPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
      {/* Tema / utseende */}
      <Card className="rounded-2xl bg-card border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Tema & Utseende
          </CardTitle>
          <CardDescription>Växla mellan ljus/mörk eller följ system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              Ljus
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              Mörk
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kontoinformation */}
      <AccountCard
        to="/account/settings"
        title="Kontoinformation"
        description="Ändra användarnamn, e-post eller lösenord."
        icon={<User className="w-5 h-5 text-primary" />}
      />

      {/* Notisinställningar */}
      <AccountCard
        to="/account/notifications"
        title="Notisinställningar"
        description="Hantera push- och e-postnotiser."
        icon={<Bell className="w-5 h-5 text-primary" />}
      />
    </div>
  );
}
