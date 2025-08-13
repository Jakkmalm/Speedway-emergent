// src/pages/MyMatchesPage.jsx
import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, AlertTriangle } from "lucide-react";
import { getUserMatches, resolveUserMatch } from "../api/matches";

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyMatchesPage() {
  const [userMatches, setUserMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const data = await getUserMatches();
      setUserMatches(data);
    } catch (e) {
      console.error("Error loading user matches:", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (userMatchId, action) => {
    setLoading(true);
    try {
      await resolveUserMatch(userMatchId, action);
      await load();
      alert("Konflikt löst!");
    } catch (e) {
      alert("Kunde inte lösa konflikt: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Mina matcher
        </CardTitle>
        <CardDescription>Matcher du har fyllt i protokoll för</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {userMatches.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Du har inte fyllt i några matcher än</p>
          ) : (
            userMatches.map((userMatch) => {
              const { match_details, user_results, official_results, discrepancies, status } = userMatch;
              return (
                <div key={userMatch.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-4">
                      <div className="font-semibold">
                        {match_details?.home_team} vs {match_details?.away_team}
                      </div>
                      <Badge variant={
                        status === "validated" ? "default" :
                        status === "disputed" ? "destructive" : "secondary"
                      }>
                        {status === "validated" ? "Validerad" :
                         status === "disputed" ? "Konflikt" : "Komplett"}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {user_results?.home_score} - {user_results?.away_score}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(match_details?.date)}</div>
                    </div>
                  </div>

                  {discrepancies && discrepancies.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                        <span className="font-medium text-yellow-800">Avvikelser upptäckta</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {discrepancies.map((disc, i) => (
                          <div key={`${disc.type}-${i}`} className="flex justify-between">
                            <span>{disc.type === "home_score" ? "Hemmalag poäng" : "Bortalag poäng"}:</span>
                            <span>Du: {disc.user_value} | Officiellt: {disc.official_value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <Button size="sm" onClick={() => resolve(userMatch.id, "accept_official")} disabled={loading}>
                          Acceptera officiellt
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resolve(userMatch.id, "keep_user")} disabled={loading}>
                          Behåll mitt
                        </Button>
                      </div>
                    </div>
                  )}

                  {official_results && discrepancies.length === 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Officiellt resultat:{" "}
                      <span className="font-medium">
                        {official_results.home_score} - {official_results.away_score}
                      </span>{" "}
                      (från {official_results.source || "källa okänd"})
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
