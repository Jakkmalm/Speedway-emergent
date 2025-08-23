// src/pages/MatchesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getMatches,
  deleteMatch,
  getOfficialMatches,
  createFromOfficial,
  getMatchById,
} from "../api/matches";
import { useAuth } from "../contexts/AuthContext";
import MatchList from "../components/MatchList";

export default function MatchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [official, setOfficial] = useState([]);
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const selectedOfficial = useMemo(
    () => official.find((x) => x.id === selectedOfficialId) || null,
    [official, selectedOfficialId]
  );

  const load = async () => {
    try {
      const m = await getMatches();
      setMatches(m);
    } catch (e) {
      console.error("Error loading matches:", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const all = await getOfficialMatches();

        // === NORMAL: dagens matcher ===
        // const today = new Date();
        // const onlyToday = (all || []).filter((m) =>
        //   isSameDay(new Date(m.date), today)
        // );
        all.sort((a, b) => new Date(a.date) - new Date(b.date));
        setOfficial(all);
      } catch (e) {
        console.error("Failed to load official matches:", e);
      }
    };
    run();
  }, [user]);

  // const onSelectOfficial = async (officialId) => {
  //   setSelectedOfficialId(officialId);
  //   const m = official.find((x) => x.id === officialId);
  //   if (!m) return;

  //   try {
  //     const res = await createFromOfficial(m.id); // bör returnera { match_id } eller { match }
  //     // const createdId = res.match?.id || res.match_id;

  //     const createdId = await getMatchById(match_id);

  //     setMatches((prev) => (res.match ? [res.match, ...prev] : prev));

  //     navigate(`/match/${createdId}`);
  //   } catch (e) {
  //     alert("Kunde inte skapa match från official: " + e.message);
  //   }
  // };

  const onSelectOfficial = async (officialId) => {
    setSelectedOfficialId(officialId);
    const m = official.find((x) => x.id === officialId);
    if (!m) return;

    try {
      const { match_id } = await createFromOfficial(m.id);
      const created = await getMatchById(match_id); // token följer med
      setMatches((prev) => [created, ...prev]);
      navigate(`/match/${match_id}`);
    } catch (e) {
      alert("Kunde inte skapa/ladda matchen: " + e.message);
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

  return (
    <div className="grid gap-6">
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Välj officiell match</CardTitle>
            <CardDescription>
              Välj från listan för att skapa din match
            </CardDescription>
          </CardHeader>
          <CardContent >
            <div className="mb-4">
              <Label>Officiella matcher</Label>
              <Select
                value={selectedOfficialId ?? undefined}
                onValueChange={onSelectOfficial}
              >
                <SelectTrigger className="">
                  <SelectValue
                    placeholder={
                      official.length
                        ? "Välj match…"
                        : "Inga officiella matcher"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="">
                  {official.map((m) => (
                    <SelectItem
                      key={m.id} value={m.id}>
                      {m.home_team} vs {m.away_team} •{" "}
                      {new Date(m.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {new Date(m.date).toLocaleDateString("sv-SE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOfficial && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Vald: <strong>{selectedOfficial.home_team}</strong> vs{" "}
                  <strong>{selectedOfficial.away_team}</strong> •{" "}
                  {new Date(selectedOfficial.date).toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
