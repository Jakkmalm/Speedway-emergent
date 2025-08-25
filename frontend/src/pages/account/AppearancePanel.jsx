import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export default function AppearancePanel() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader><CardTitle>Tema & utseende</CardTitle></CardHeader>
      <CardContent className="flex gap-2">
        <Button size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>Ljus</Button>
        <Button size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>Mörk</Button>
        <Button size="sm" variant={theme === "system" ? "default" : "outline"} onClick={() => setTheme("system")}>System</Button>
      </CardContent>
    </Card>
  );
}
