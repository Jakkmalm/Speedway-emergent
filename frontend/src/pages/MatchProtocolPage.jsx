// src/pages/MatchProtocolPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { apiCall, getToken } from "@/api/client";
import {
  getMatchById,
  clearHeatResults,
  putHeatResults,
  updateHeatRiders,
  confirmMatch
} from "../api/matches";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Trophy, Target, AlertTriangle, Play, Save } from "lucide-react";
import HeatDialog from "@/components/HeatDialog";
import NominationDialog from "@/components/NominationDialog";
import { useAuth } from "../contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils"; // justera sökväg om nötig

import { toast } from "sonner";
import { ConfirmButton } from "@/components/ConfirmButton";


// const API_BASE_URL =
//   process.env.REACT_APP_BACKEND_URL || "http://localhost:8002";

// Summerar totaler från sparade heat i matchen
// const computeTotalsFromHeats = (match) => {
//   let home = 0,
//     away = 0;
//   if (!match?.heats) return { home, away };
//   for (const h of match.heats) {
//     if (!Array.isArray(h.results)) continue;
//     for (const res of h.results) {
//       const pts = Number(res.points) || 0;
//       const riderEntry = Object.values(h.riders || {}).find(
//         (g) => String(g?.rider_id) === String(res.rider_id)
//       );
//       const team = riderEntry?.team;
//       if (team === "home") home += pts;
//       else if (team === "away") away += pts;
//     }
//   }
//   return { home, away };
// };



function isMatchComplete(match) {
  if (!match?.heats || match.heats.length < 15) return false;
  return match.heats.every(
    (h) => h?.status === "completed" && (h?.results?.length ?? 0) >= 4
  );
}

export default function MatchProtocolPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  // const [ridersByTeam, setRidersByTeam] = useState({});
  const [ridersByTeam, setRidersByTeam] = useState({ home: [], away: [] });

  const matchId = useParams();
  const [saving, setSaving] = useState(false);
  const complete = useMemo(() => isMatchComplete(match), [match]);

  // --- 8-poängsregel: state + helpers ---
  // const [laneChoiceByHeat, setLaneChoiceByHeat] = useState({}); // "matchId#heat" -> { team:'home'|'away', pair:'13'|'24' }
  // const [originalRidersByHeat, setOriginalRidersByHeat] = useState({}); // "matchId#heat" -> snapshot av ursprungliga riders

  const heatKeyOf = (matchId, heatNumber) => `${matchId}#${heatNumber}`;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedHeat, setSelectedHeat] = useState(null);

  const [nomOpen, setNomOpen] = useState(false);

  //
  const getRules = (m) => m?.meta?.rules ?? {};
  const tacticalRules = (m) => ({
    enabled: getRules(m).tactical?.enabled ?? true,
    start: getRules(m).tactical?.start_heat ?? 5,
    end: getRules(m).tactical?.end_heat ?? 13,
    minDef: getRules(m).tactical?.min_deficit ?? 6,
  });

  // Gruppar alla unika förare per team
  const buildRidersByTeam = (match) => {
    const map = {};
    match.heats.forEach((heat) => {
      Object.values(heat.riders).forEach((rider) => {
        if (!map[rider.team]) {
          map[rider.team] = [];
        }
        if (!map[rider.team].some((r) => r.id === rider.rider_id)) {
          map[rider.team].push({ id: rider.rider_id, name: rider.name });
        }
      });
    });
    return map;
  };

  // === NYTT: dialog-state
  // const [dialogOpen, setDialogOpen] = useState(false);
  // const [selectedHeat, setSelectedHeat] = useState(null);

  //   const reloadMatch = useCallback(async () => {
  //     if (!id) return;
  //     const res = await fetch(`${API_BASE_URL}/api/matches/${id}`, {
  //       headers: { "Content-Type": "application/json" },
  //     });
  //     if (!res.ok) throw new Error("Kunde inte ladda matchen");
  //     const data = await res.json();
  //     setMatch(data);
  //     setRidersByTeam(buildRidersByTeam(data)); // <-- här
  //   }, [id]);

  // const reloadMatch = useCallback(async () => {
  //   if (!id) return;
  //   const data = await apiCall(`/api/matches/${id}`);
  //   setMatch(data);
  // }, [id]);

  // Ladda matchen bara från URL-parametern
  const reloadMatch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getMatchById(id);
      setMatch(data);
      // setRidersByTeam(buildRidersByTeam(data)); // <-- viktig
    } catch (e) {
      // 403 betyder oftast “inte din match” → tillbaka till /matches
      if (e.status === 403) navigate("/matches");
      else alert("Kunde inte ladda matchen: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    let ignore = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        if (!id || id === "preview") {
          setMatch(null);
          return;
        }
        await reloadMatch();
      } catch (e) {
        if (!ignore) setError(e.message || "Något gick fel");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, reloadMatch]);

  // === Helpers (lokala för sidan) ===
  const getStatusBadge = (status) => {
    switch (status) {
      case "confirmed":
        return <Badge>Bekräftad</Badge>;
      case "live":
        return <Badge variant="destructive">Pågår</Badge>;
      case "completed":
        return <Badge variant="secondary">Avslutad</Badge>;
      case "upcoming":
      default:
        return <Badge variant="secondary">Kommande</Badge>;
    }
  };

  const getPositionColor = (position) => {
    switch (position) {
      case 1:
        return "bg-yellow-500 text-black";
      case 2:
        return "bg-gray-400 text-white";
      case 3:
        return "bg-amber-600 text-white";
      case 4:
        return "bg-gray-600 text-white";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  const isHeatSavedComplete = (heat) => {
    if (!heat || !Array.isArray(heat.results) || heat.results.length === 0)
      return false;
    const used = new Set();
    for (const gate of Object.keys(heat.riders).sort()) {
      const riderId = heat.riders[gate].rider_id;
      const res = heat.results.find(
        (r) => String(r.rider_id) === String(riderId)
      );
      if (!res) return false;
      if (res.status === "completed") {
        const pos = Number(res.position);
        if (!Number.isInteger(pos) || pos < 1 || pos > 4) return false;
        if (used.has(pos)) return false;
        used.add(pos);
      } else if (res.status !== "excluded") {
        return false;
      }
    }
    return true;
  };

  const computeHeatBonuses = (heat) => {
    const bonuses = {};
    if (!heat || !Array.isArray(heat.results)) return bonuses;
    const finished = heat.results
      .filter((r) => r.status === "completed" && typeof r.position === "number")
      .sort((a, b) => a.position - b.position);
    if (finished.length < 3) return bonuses;
    const riderTeams = {};
    Object.values(heat.riders).forEach(
      (r) => (riderTeams[r.rider_id] = r.team)
    );
    if (riderTeams[finished[0].rider_id] === riderTeams[finished[1].rider_id]) {
      bonuses[finished[1].rider_id] = 1;
    }
    if (riderTeams[finished[1].rider_id] === riderTeams[finished[2].rider_id]) {
      bonuses[finished[2].rider_id] = 1;
    }
    return bonuses;
  };

  const computeTotalsFromHeats = (m) => {
    let home = 0,
      away = 0;
    if (!m?.heats) return { home, away };
    for (const h of m.heats) {
      if (!Array.isArray(h.results)) continue;
      for (const res of h.results) {
        const pts = Number(res.points) || 0;
        const riderEntry = Object.values(h.riders || {}).find(
          (g) => String(g?.rider_id) === String(res.rider_id)
        );
        const team = riderEntry?.team;
        if (team === "home") home += pts;
        if (team === "away") away += pts;
      }
    }
    return { home, away };
  };

  // Totalscore per lag (uppdateras när matchen ändras)
  const { home: homeScore, away: awayScore } = useMemo(
    () => computeTotalsFromHeats(match),
    [match]
  );

  // Här definieras canUseTactical och används av HeatDialog
  // const canUseTactical = useCallback(
  //   (team) => {
  //     if (!match) return false;
  //     const diff = Math.abs(homeScore - awayScore);
  //     const isLosing =
  //       team === "home" ? homeScore < awayScore : awayScore < homeScore;
  //     return diff >= MIN_TACTICAL_DIFF && isLosing;
  //   },
  //   [match, homeScore, awayScore]
  // );

  const canUseTactical = useCallback(
    (team) => {
      if (!match || !selectedHeat) return false;
      const t = tacticalRules(match);
      if (!t.enabled) return false;

      const hn = selectedHeat.heat_number;
      if (hn < t.start || hn > t.end) return false;

      const { home, away } = computeTotalsFromHeats(match);
      const diff = Math.abs(home - away);
      const losing = team === "home" ? home < away : away < home;

      return losing && diff >= t.minDef;
    },
    [match, selectedHeat]
  );

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // === NYTT: öppna dialog
  const openHeatDialog = (heat) => {
    setSelectedHeat(heat);
    setDialogOpen(true);
  };

  // === NYTT: när dialogen sparar -> hämta match igen + stäng
  const handleSaved = async () => {
    await reloadMatch();
    setDialogOpen(false);
    setSelectedHeat(null);
  };

  // === NYTT: när dialogen stängs utan att spara
  const handleClose = () => {
    setDialogOpen(false);
    setSelectedHeat(null);
  };

  const handleDialogOpenChange = (open) => {
    setDialogOpen(open);
    if (!open) setSelectedHeat(null);
  };

  /////// TEST
  const openDialogFor = (heat) => {
    setSelectedHeat(heat); // 1) välj heat först
    setDialogOpen(true); // 2) öppna efter
  };

  const closeDialog = () => {
    setDialogOpen(false);
    // Nollställ heatet efter att dialogen stängts (nästa tick)
    setTimeout(() => setSelectedHeat(null), 0);
  };

  // spara (anropas av HeatDialog)
  const handleSave = useCallback(
    async ({ heat_number, assignments, results }) => {
      if (!getToken()) {
        alert("Du måste vara inloggad för att spara resultat.");
        return;
      }
      if (!match?.id || !heat_number) return;

      // 1) byt förare (om några)
      if (assignments && Object.keys(assignments).length > 0) {
        await apiCall(`/api/matches/${match.id}/heat/${heat_number}/riders`, {
          method: "PUT",
          body: JSON.stringify(assignments),
        });
      }

      // 2) nollställ resultat
      await apiCall(`/api/matches/${match.id}/heat/${heat_number}/result`, {
        method: "PUT",
        body: JSON.stringify({ results: [] }),
      });

      // 3) skriv nya resultat
      await apiCall(`/api/matches/${match.id}/heat/${heat_number}/result`, {
        method: "PUT",
        body: JSON.stringify({ results }),
      });

      // 4) hämta uppdaterad match
      const data = await apiCall(`/api/matches/${match.id}`);
      setMatch(data);
    },
    [match?.id] // <-- selectedHeat tas bort ur dependencies
  );

  // === NYTT: spara matchen
  // Spara/confirm – använder id från useParams
  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await toast.promise(confirmMatch(id), {
        loading: "Sparar…",
        success: "Protokoll sparat",
        error: (e) => e?.detail || "Kunde inte spara protokollet",
      });

      if (res?.discrepancies?.length) {
        const text = res.discrepancies
          .map((d) => `${d.type}: ${d.user_value} → ${d.official_value}`)
          .join(" • ");
        toast("Skillnader mot officiella resultat", {
          description: text,
          closeButton: true,
          duration: 12000,
        });
      }

      navigate("/my-matches", { replace: true, state: { justSaved: true } });
    } finally {
      setSaving(false);
    }
  }, [id, navigate]);

  // const handleSave = useCallback(
  //   async ({ assignments, results }) => {
  //     if (!match || !selectedHeat) return;

  //     // 1) byten
  //     if (assignments && Object.keys(assignments).length) {
  //       await updateHeatRiders(match.id, selectedHeat.heat_number, assignments);
  //     }
  //     // 2) nollställ
  //     await clearHeatResults(match.id, selectedHeat.heat_number);
  //     // 3) skriv
  //     await putHeatResults(match.id, selectedHeat.heat_number, results);
  //     // 4) hämta om
  //     await reload();
  //   },
  //   [match, selectedHeat, reloadMatch]
  // );

  // === Hämta match utifrån :id ===
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError("");
      setLoading(true);
      try {
        if (!id || id === "preview") {
          setMatch(null);
          return;
        }

        const data = await getMatchById(id); // <-- går via apiCall -> skickar token
        if (!cancelled) setMatch(data);
        // setRidersByTeam(buildRidersByTeam(data)); // <-- viktig
      } catch (e) {
        if (cancelled) return;
        // vår apiCall sätter e.status, e.message
        if (e.status === 401 || e.status === 403) {
          // inte autentiserad/obehörig -> skicka till login
          navigate("/auth", { replace: true, state: { from: `/match/${id}` } });
          return;
        }
        setError(e.message || "Kunde inte ladda matchen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // ---- Ladda trupper för båda lagen när match finns ----
  useEffect(() => {
    let ignore = false;
    async function loadRosters() {
      if (!match?.home_team_id || !match?.away_team_id) return;
      try {
        const [home, away] = await Promise.all([
          apiCall(`/api/teams/${match.home_team_id}/riders`),
          apiCall(`/api/teams/${match.away_team_id}/riders`),
        ]);
        if (ignore) return;
        const toOpts = (xs) =>
          xs.map((r) => ({
            id: String(r.id),
            name: r.name,
            lineup_no: r.lineup_no,
            is_reserve: !!r.is_reserve,
          }));
        setRidersByTeam({
          home: [...toOpts(home.mains || []), ...toOpts(home.reserves || [])],
          away: [...toOpts(away.mains || []), ...toOpts(away.reserves || [])],
        });
      } catch (e) {
        console.error("Kunde inte ladda trupper:", e);
      }
    }
    loadRosters();
    return () => {
      ignore = true;
    };
  }, [match?.home_team_id, match?.away_team_id]);

  // === Render ===
  if (loading) {
    return <div className="p-6">Laddar match…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
        <div className="mt-4">
          <Button onClick={() => navigate("/matches")}>Till matcher</Button>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Target className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Inget matchprotokoll aktivt
          </h3>
          <p className="text-gray-500 text-center max-w-md mb-4">
            Öppna en match från sidan “Matcher” för att börja föra protokoll.
          </p>
          <Button onClick={() => navigate("/matches")}>Gå till Matcher</Button>
        </CardContent>
      </Card>
    );
  }

  const completedHeats =
    match.heats?.filter((h) => h.status === "completed").length || 0;

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <Card>
        {completedHeats >= 13 && (
          <div className="flex justify-end">
            <Button onClick={() => setNomOpen(true)}>
              Nominera Heat 14–15
            </Button>
          </div>
        )}
        <CardHeader>
          <CardTitle className="text-2xl flex items-center justify-between">
            <span>
              {match.home_team} vs {match.away_team}
            </span>
            {getStatusBadge(match.status)}
          </CardTitle>
          <CardDescription>
            {formatDate(match.date)} • {match.venue || "Arena ej angiven"} •{" "}
            {completedHeats}/15 Heat komplett
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-red-600">{homeScore}</div>
              <div className="text-sm text-gray-600 mb-2">
                {match.home_team}
              </div>
              <div className="flex justify-center space-x-1 mb-2">
                <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="text-lg text-gray-400">-</div>
              {/* {getStatusBadge(match.status)} */}
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-600">
                {awayScore}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                {match.away_team}
              </div>
              <div className="flex justify-center space-x-1 mb-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <div className="w-4 h-4 bg-white border border-gray-300 rounded-full"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heat Program */}
      <Card>
        <CardHeader>
          <CardTitle>Heat Program</CardTitle>
          <CardDescription>
            Alla 15 förbestämda heat för matchen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {match.heats?.map((heat) => {
              const prevHeat = match.heats.find(
                (h) => h.heat_number === heat.heat_number - 1
              );
              const canOpenThis =
                heat.heat_number === 1 ||
                (prevHeat && isHeatSavedComplete(prevHeat));
              console.log(canOpenThis);
              const bonuses = computeHeatBonuses(heat);

              return (
                <Card
                  key={heat.heat_number}
                  className="rounded-2xl border bg-card transition hover:bg-accent/40"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Heat {heat.heat_number}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(heat.status)}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <Separator />

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.keys(heat.riders)
                        .sort()
                        .map((gate) => {
                          const rider = heat.riders[gate];
                          const result = heat.results?.find((r) => r.rider_id === rider.rider_id);
                          const bonus = bonuses[rider.rider_id] || 0;

                          // behåller dina gate-färger (domänspecifika)
                          const gateStyle =
                            rider.team === "home"
                              ? gate === "1" || gate === "3"
                                ? "border-l-4 border-red-600 bg-red-50 dark:bg-red-950/30"
                                : "border-l-4 border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                              : gate === "2" || gate === "4"
                                ? "border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30"
                                : "border-l-4 border-gray-300 bg-muted";

                          return (
                            <Card
                              key={gate}
                              className={cn(
                                "p-2 text-center shadow-none",
                                "rounded-md border",
                                gateStyle
                              )}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {/* gate-badge */}
                                <span className="w-5 h-5 bg-muted rounded-full text-xs flex items-center justify-center">
                                  {gate}
                                </span>
                                {/* hjälmfärg-dot */}
                                <span
                                  className="w-3 h-3 rounded-full border"
                                  style={{
                                    backgroundColor: rider.helmet_color,
                                    borderColor:
                                      rider.helmet_color === "#FFFFFF"
                                        ? "#ccc"
                                        : rider.helmet_color,
                                  }}
                                />
                              </div>

                              <div className="font-medium text-xs mt-1 text-foreground">
                                {rider.name}
                              </div>

                              {result && (
                                <div className="mt-1">
                                  {result.status === "completed" && (
                                    <Badge className={cn("text-xs", getPositionColor(result.position))}>
                                      {result.position}. ({result.points}
                                      {bonus ? `+${bonus}` : ""} p)
                                    </Badge>
                                  )}

                                  {result.status === "excluded" && (
                                    <Badge className="text-xs bg-destructive text-destructive-foreground">
                                      <AlertTriangle className="w-3 h-3" />
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </Card>
                          );
                        })}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="w-full"
                            onClick={() => openDialogFor(heat)}
                            size="sm"
                            disabled={!canOpenThis}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Registrera resultat
                          </Button>
                        </TooltipTrigger>
                        {!canOpenThis && (
                          <TooltipContent side="top">
                            <p>Fyll i Heat {heat.heat_number - 1} först</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <div className="sticky bottom-4 z-10 flex justify-end">
            <ConfirmButton
              title="Spara protokoll?"
              description="Protokollet hamnar i Mina protokoll. Du kan öppna det senare."
              confirmText="Spara"
              cancelText="Avbryt"
              triggerVariant="default"
              actionVariant="default"
              onConfirm={doSave}
              disabled={!complete || saving}         // ← förs vidare till trigger-knappen
              className="w-full min-w-[180px]"       // ← förs vidare till trigger-knappen
            >
              <Save className="w-4 h-4 mr-2" />
              Spara protokoll
            </ConfirmButton>
          </div>
        </CardContent>
      </Card>
      {/* NYTT: Själva dialogen */}
      <HeatDialog
        open={dialogOpen}
        onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}
        match={match}
        heat={selectedHeat}
        ridersByTeam={ridersByTeam}
        canUseTactical={canUseTactical}
        tacticalWindow={{
          start: tacticalRules(match).start,
          end: tacticalRules(match).end,
        }}
        heatSwapGuard={(liveHeat, draftRiders) => {
          // enkel guard i UI: max 1 byte visuellt
          let changed = 0;
          Object.keys(liveHeat?.riders || {}).forEach((g) => {
            const beforeId = String(liveHeat.riders[g]?.rider_id ?? "");
            const afterId = String(draftRiders[g]?.rider_id ?? "");
            if (beforeId !== afterId) changed++;
          });
          if (changed > 1) {
            alert("Endast en taktisk reserv kan användas per heat.");
            return false;
          }
          return true;
        }}
        onSave={handleSave}
      />
      <NominationDialog
        open={nomOpen}
        onClose={() => setNomOpen(false)}
        match={match}
        onSaved={async () => {
          // hämta om matchen efter save
          await reloadMatch();
        }}
      />
    </div>
  );
}
