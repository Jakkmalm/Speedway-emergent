// src/pages/HomePage.jsx
import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import TeamTable from "../components/TeamTable";
import { getTeams } from "../api/teams";
import { Trophy } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";

export default function HomePage() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    getTeams().then(setTeams).catch((e) => console.error("Error loading teams:", e));
  }, []);

  return (
    <Card className="">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
          Elitserien Tabell
        </CardTitle>
        <CardDescription>Aktuell ställning i Speedway Elitserien</CardDescription>
      </CardHeader>
      <CardContent>
        {teams ? (
          <TeamTable teams={teams} />
        ) : (
          // Skeleton placeholder (4 rader)
          <div className="space-y-2">
            <Skeleton className="h-[40px] w-full rounded-md" />
            <Skeleton className="h-[40px] w-full rounded-md" />
            <Skeleton className="h-[40px] w-full rounded-md" />
            <Skeleton className="h-[40px] w-full rounded-md" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
