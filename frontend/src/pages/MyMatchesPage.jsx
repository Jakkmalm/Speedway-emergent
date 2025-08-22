// src/pages/MyMatchesPage.jsx
import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Calendar } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, AlertTriangle } from "lucide-react";
import { getUserMatches, resolveUserMatch, deleteMatch, getMatches } from "../api/matches";
import { useAuth } from "../contexts/AuthContext";
import MatchList from "../components/MatchList";
import UserMatchCard from "@/components/UserMatchCard";
import { toast } from "sonner";

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
  const [loadingResolve, setLoadingResolve] = useState(false);

  const { user } = useAuth();
  const [matches, setMatches] = useState([]);

  const loadUserMatches = async () => {
    try {
      const data = await getUserMatches();
      setUserMatches(data);
    } catch (e) {
      console.error("Error loading user matches:", e);
    }
  };

  const loadMatches = async () => {
    try {
      const m = await getMatches();
      setMatches(m);
    } catch (e) {
      console.error("Error loading matches:", e);
    }
  };

  useEffect(() => {
    loadUserMatches();
    loadMatches();
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

  // const handleDelete = async (id) => {
  //   if (!window.confirm("Ta bort matchen?")) return;
  //   try {
  //     await deleteMatch(id);
  //     setMatches((prev) => prev.filter((m) => m.id !== id));
  //   } catch (e) {
  //     alert("Kunde inte ta bort match: " + e.message);
  //   }
  // };

  const handleDelete = async (id) => {
    await toast.promise(deleteMatch(id), {
      loading: "Tar bort…",
      success: "Match borttagen",
      error: "Kunde inte ta bort matchen",
    });
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };


  return (
    <>
      {/* Mina matcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Mina matcher
          </CardTitle>
          <CardDescription>Matcher du har fyllt i protokoll för</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userMatches.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Du har inte fyllt i några matcher än
              </p>
            ) : (
              userMatches.map((um) => (
                <UserMatchCard
                  key={um.id || um._id}
                  userMatch={um}
                  onResolve={resolve}
                  loadingResolve={loadingResolve}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
      {/* <Card>
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
      </Card> */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Skapade matcher
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MatchList
            matches={matches}
            userId={user?.id}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

    </>
  );
}
