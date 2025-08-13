import React, { useState, useEffect } from "react";
import { HeatRow } from "./components/HeatRow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Trophy,
  Users,
  Calendar,
  Target,
  CheckCircle,
  Clock,
  Play,
  Star,
  Zap,
  AlertTriangle,
  Repeat,
  Edit,
  Save,
  X,
} from "lucide-react";
import "./App.css";

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8002";

function App() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [userMatches, setUserMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("seriespel");

  // Auth forms
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  // Match creation
  const [matchForm, setMatchForm] = useState({
    home_team_id: "",
    away_team_id: "",
    date: "",
    venue: "",
  });

  // Heat result form
  const [currentHeat, setCurrentHeat] = useState(null);
  const [editingHeat, setEditingHeat] = useState(null);
  const [heatResults, setHeatResults] = useState({});

  // max 1 taktisk reserv per heat: "matchId#heatNr" -> { team, gate, riderId }
  const [tacticalByHeat, setTacticalByHeat] = useState({});

  // Val av startspår per heat: "matchId#heat" -> { team: 'home'|'away', pair: '13'|'24' }
  const [laneChoiceByHeat, setLaneChoiceByHeat] = useState({});

  // Spara originaluppställning för att kunna återställa: "matchId#heat" -> riders snapshot
  const [originalRidersByHeat, setOriginalRidersByHeat] = useState({});

  useEffect(() => {
    setTacticalByHeat({});
  }, [currentMatch?.id]);
  useEffect(() => {
    setLaneChoiceByHeat({});
    setOriginalRidersByHeat({});
  }, [currentMatch?.id]);

  // Match confirmation
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Regler för taktisk reserv – ändra bara här om reglerna uppdateras
  const TACTICAL_START_HEAT = 5; // första heat där taktisk reserv är tillåten
  const TACTICAL_END_HEAT = 13; // sista heat där taktisk reserv är tillåten
  const MIN_TACTICAL_DIFF = 6; // laget måste ligga minst så här många poäng efter för att få toppa

  // Förare per lag – fylls på via API när en match laddas
  const [ridersByTeam, setRidersByTeam] = useState({ home: [], away: [] });

  // Håller reda på om taktisk reserv har använts av ett lag (home/away) i denna match
  const [tacticalUsed, setTacticalUsed] = useState({
    home: false,
    away: false,
  });

  // Håller reda på vilka förare som redan “toppats” (använts som taktisk reserv) och inte får användas igen
  const [toppedRiders, setToppedRiders] = useState([]);

  // Nollställ taktiskUsed när en ny match laddas
  useEffect(() => {
    setTacticalUsed({ home: false, away: false });
  }, [currentMatch]);

  // useEffect(() => {
  //   async function loadRiders() {
  //     if (!currentMatch) return;
  //     try {
  //       // Hämta alla förare i hemmalaget och bortalaget
  //       const homeRiders = await apiCall(
  //         `/api/teams/${currentMatch.home_team_id}/riders`
  //       );
  //       const awayRiders = await apiCall(
  //         `/api/teams/${currentMatch.away_team_id}/riders`
  //       );
  //       // Sätt state { home: [...], away: [...] }
  //       setRidersByTeam({ home: homeRiders, away: awayRiders });
  //     } catch (err) {
  //       console.error("Kunde inte ladda förare:", err);
  //     }
  //   }
  //   loadRiders();
  // }, [currentMatch]);
  useEffect(() => {
    // Nollställ taktisk reserv och toppningar vid ny match
    setTacticalUsed({ home: false, away: false });
    setToppedRiders([]);

    async function loadRiders() {
      if (!currentMatch) return;
      let homeRiders = [];
      let awayRiders = [];
      try {
        homeRiders = await apiCall(
          `/api/teams/${currentMatch.home_team_id}/riders`
        );
        awayRiders = await apiCall(
          `/api/teams/${currentMatch.away_team_id}/riders`
        );
      } catch (e) {
        // Om API-anropet misslyckas, fall tillbaka på nedan
      }

      // Fallback: extrahera unika förare från heatens ursprungliga riderdata
      if (!homeRiders.length) {
        const seen = new Set();
        homeRiders = currentMatch.heats
          .flatMap((h) =>
            Object.values(h.riders).filter((r) => r.team === "home")
          )
          .filter((r) => {
            if (seen.has(r.rider_id)) return false;
            seen.add(r.rider_id);
            return true;
          });
      }
      if (!awayRiders.length) {
        const seen = new Set();
        awayRiders = currentMatch.heats
          .flatMap((h) =>
            Object.values(h.riders).filter((r) => r.team === "away")
          )
          .filter((r) => {
            if (seen.has(r.rider_id)) return false;
            seen.add(r.rider_id);
            return true;
          });
      }
      setRidersByTeam({ home: homeRiders, away: awayRiders });
    }
    loadRiders();
  }, [currentMatch]);

  // === helpers ===
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const toDatetimeLocal = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Hjälm/färg per gate
  const helmetColorFor = (team, gate) => {
    // Home: 1,3 röd; 2,4 blå.  Away: 2,4 gul; 1,3 vit.
    if (team === "home") {
      return gate === "1" || gate === "3" ? "#DC2626" : "#2563EB"; // red / blue
    } else {
      return gate === "2" || gate === "4" ? "#EAB308" : "#FFFFFF"; // yellow / white
    }
  };

  const heatKeyOf = (matchId, heatNumber) => `${matchId}#${heatNumber}`;

  const snapshotOriginalIfMissing = (heat) => {
    const key = heatKeyOf(currentMatch.id, heat.heat_number);
    if (!originalRidersByHeat[key]) {
      setOriginalRidersByHeat((prev) => ({
        ...prev,
        [key]: JSON.parse(JSON.stringify(heat.riders)), // deep copy
      }));
    }
  };

  const restoreOriginalRidersForHeat = (heatNumber) => {
    const key = heatKeyOf(currentMatch.id, heatNumber);
    const snapshot = originalRidersByHeat[key];
    if (!snapshot) return;

    setCurrentMatch((prev) => {
      const updatedHeats = prev.heats.map((h) => {
        if (h.heat_number !== heatNumber) return h;
        return { ...h, riders: JSON.parse(JSON.stringify(snapshot)) };
      });
      return { ...prev, heats: updatedHeats };
    });

    setLaneChoiceByHeat((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Applicera 1&3 eller 2&4 för förlorande lag i ett enskilt heat (frontend)
  const applyLaneChoiceToHeat = (heatNumber, team, pair /* '13' | '24' */) => {
    const key = heatKeyOf(currentMatch.id, heatNumber);
    const heat = currentMatch.heats.find((h) => h.heat_number === heatNumber);
    if (!heat) return;

    // Spara original första gången
    snapshotOriginalIfMissing(heat);

    const chosenGates = pair === "13" ? ["1", "3"] : ["2", "4"];
    const otherGates = pair === "13" ? ["2", "4"] : ["1", "3"];

    // Plocka ut riders per lag i detta heat
    const entries = Object.entries(heat.riders); // [["1", obj], ["2", obj], ...]
    const teamRiders = entries
      .filter(([g, r]) => r.team === team)
      .map(([g, r]) => ({ gate: g, rider: r }));
    const otherRiders = entries
      .filter(([g, r]) => r.team !== team)
      .map(([g, r]) => ({ gate: g, rider: r }));

    if (teamRiders.length !== 2 || otherRiders.length !== 2) {
      console.warn("Heat måste ha 2 + 2 förare för laneswaps");
      return;
    }

    // Ny rider-karta
    const newRiders = { ...heat.riders };

    // Behåll ordning: första teamRider -> första gate i paret, osv.
    newRiders[chosenGates[0]] = {
      ...teamRiders[0].rider,
      // uppdatera id/name oförändrat; sätt hjälmfärg efter ny gate
      helmet_color: helmetColorFor(team, chosenGates[0]),
      team, // säkerställ team ligger kvar korrekt
    };
    newRiders[chosenGates[1]] = {
      ...teamRiders[1].rider,
      helmet_color: helmetColorFor(team, chosenGates[1]),
      team,
    };
    // Motståndarna får de andra två banorna
    const otherTeam = team === "home" ? "away" : "home";
    newRiders[otherGates[0]] = {
      ...otherRiders[0].rider,
      helmet_color: helmetColorFor(otherTeam, otherGates[0]),
      team: otherTeam,
    };
    newRiders[otherGates[1]] = {
      ...otherRiders[1].rider,
      helmet_color: helmetColorFor(otherTeam, otherGates[1]),
      team: otherTeam,
    };

    // Sätt i state
    setCurrentMatch((prev) => {
      const updatedHeats = prev.heats.map((h) => {
        if (h.heat_number !== heatNumber) return h;
        return { ...h, riders: newRiders };
      });
      return { ...prev, heats: updatedHeats };
    });

    setLaneChoiceByHeat((prev) => ({
      ...prev,
      [key]: { team, pair },
    }));
  };

  // När underläget sjunker under 8 måste vi återgå till tidigare fastställda startpositioner
  useEffect(() => {
    if (!currentMatch?.heats) return;

    const diff = Math.abs(currentMatch.home_score - currentMatch.away_score);
    if (diff >= 8) return; // inget att återställa

    // Återställ alla kommande (upcoming) heat som har laneChoice satt
    currentMatch.heats
      .filter((h) => h.status === "upcoming")
      .forEach((h) => {
        const key = heatKeyOf(currentMatch.id, h.heat_number);
        if (laneChoiceByHeat[key]) {
          restoreOriginalRidersForHeat(h.heat_number);
        }
      });
  }, [currentMatch?.home_score, currentMatch?.away_score]);

  // Kolla om startspårsvälj (8-poängsregel) ska gälla – håll den separerad
  const canChooseGatesByEightPointRule = (team) => {
    if (!currentMatch) return false;
    const diff = Math.abs(currentMatch.home_score - currentMatch.away_score);
    const isLosing =
      team === "home"
        ? currentMatch.home_score < currentMatch.away_score
        : currentMatch.away_score < currentMatch.home_score;
    return diff >= 8 && isLosing;
  };

  // Räknar hur många heat en förare redan är insatt i (inkl. pågående)
  const getRidesCount = (riderId) => {
    if (!currentMatch?.heats) return 0;
    let cnt = 0;
    for (const h of currentMatch.heats) {
      const gates = h?.riders ? Object.values(h.riders) : [];
      if (gates.some((g) => String(g?.rider_id) === String(riderId))) cnt++;
    }
    return cnt;
  };

  // Är detta ett "låst" reserv-heat för denna gate/rider?
  // Du behöver ha något i datat som markerar det (t.ex. rider.is_reserve && h.reserve_locked_gates?.includes(gate))
  const isLockedReserveSlot = (heat, gate, rider) => {
    // Exempel-heuristik: om rider.role === 'reserve' och heat.meta?.reserveLocked?.includes(gate)
    // Anpassa till din faktiska datastruktur:
    return Boolean(
      heat?.meta?.reserveLocked?.includes(gate) && rider?.role === "reserve"
    );
  };

  // Sätt position exklusivt i heatet
  const setPositionExclusive = React.useCallback((riderId, pos) => {
    setHeatResults((prev) => {
      const alreadySelected = parseInt(prev?.[riderId]?.position) === pos;
      const next = { ...prev };

      // Toggle av: om samma pos är vald på samma förare -> rensa
      if (alreadySelected) {
        next[riderId] = { ...(next[riderId] || {}), position: "" };
        return next;
      }

      // Ta bort pos från alla andra förare
      Object.keys(next).forEach((id) => {
        if (id !== riderId && parseInt(next[id]?.position) === pos) {
          next[id] = { ...(next[id] || {}), position: "" };
        }
      });

      // Sätt pos på aktuell förare
      next[riderId] = { ...(next[riderId] || {}), position: pos };
      return next;
    });
  }, []);

  // Beräkna bonuspoäng enligt Elitseriereglerna
  // Räkna bonuspoäng: bonus till tvåan i ett 5–1 och trean i ett 3–3
  // Räkna bonuspoäng (2:a i ett 5–1 och 3:a i ett 3–3)
  function computeHeatBonuses(heat) {
    const bonuses = {};
    if (!heat || !Array.isArray(heat.results)) return bonuses;
    const finished = heat.results
      .filter((r) => r.status === "completed" && typeof r.position === "number")
      .sort((a, b) => a.position - b.position);
    if (finished.length < 3) return bonuses;
    const riderTeams = {};
    Object.values(heat.riders).forEach((r) => {
      riderTeams[r.rider_id] = r.team;
    });
    if (riderTeams[finished[0].rider_id] === riderTeams[finished[1].rider_id]) {
      bonuses[finished[1].rider_id] = 1;
    }
    if (riderTeams[finished[1].rider_id] === riderTeams[finished[2].rider_id]) {
      bonuses[finished[2].rider_id] = 1;
    }
    return bonuses;
  }

  // Kontrollera om ett lag får använda taktisk reserv just nu
  // Kontrollera om laget får använda taktisk reserv i detta läge
  const canUseTactical = (team) => {
    if (!currentMatch) return false;
    if (tacticalUsed[team]) return false; // laget har redan utnyttjat taktisk reserv
    const diff = Math.abs(currentMatch.home_score - currentMatch.away_score);
    const isLosing =
      team === "home"
        ? currentMatch.home_score < currentMatch.away_score
        : currentMatch.away_score < currentMatch.home_score;
    return diff >= MIN_TACTICAL_DIFF && isLosing;
  };

  // Anropa backend för att uppdatera föraruppställningen i ett heat.
  // assignments är ett objekt som mappar gate ("1"–"4") → ny rider_id.
  // Anropa API:t för att byta förare i ett heat (taktisk reserv / rider replacement)
  // Anropa backend för att byta förare i ett heat (taktisk reserv / rider replacement)
  // Anropa backend för att ändra föraruppställning i ett heat (taktisk reserv eller rider replacement)
  async function updateHeatRiders(matchId, heatNumber, assignments) {
    const token = localStorage.getItem("speedway_token");
    const response = await fetch(
      `${API_BASE_URL}/api/matches/${matchId}/heat/${heatNumber}/riders`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(assignments),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(
        data.detail || "Kunde inte uppdatera heat‑uppställningen"
      );
    }
    return response.json();
  }

  // Körs när användaren byter förare i dropdownen
  // När användaren väljer en ny förare (taktisk reserv)
  const handleChangeRider = async (heatNumber, assignments) => {
    if (!currentMatch) return;

    const gate = Object.keys(assignments)[0];
    const newRiderId = assignments[gate];

    // Hämta live-heat och gate-info
    const heat = currentMatch.heats.find((h) => h.heat_number === heatNumber);
    if (!heat) return;

    const oldGateObj = heat?.riders?.[gate];
    const team = oldGateObj?.team;
    if (!team) return;

    // 5.8.5: reservernas 3 schemalagda heat är låsta (om inte tävlingsskada/medicinskt startförbud)
    if (isLockedReserveSlot(heat, gate, oldGateObj)) {
      alert("Detta är ett låst reservheat och kan inte bytas enligt reglerna.");
      return;
    }

    // Max-heatkontroll (bas enligt 5.8.5; RR-undantag lämnas för nästa steg om/ när RR implementeras)
    const newRider = (ridersByTeam[team] || []).find(
      (r) => String(r.id) === String(newRiderId)
    );
    const ridesSoFar = getRidesCount(newRiderId);
    const isReserve =
      newRider?.role === "reserve" ||
      newRider?.number === 6 ||
      newRider?.number === 7;

    const limit = isReserve ? 5 : 6; // RR-undantag hanteras separat när du lägger RR-flagg
    if (ridesSoFar >= limit) {
      alert(
        `${
          newRider?.name || "Förare"
        } har redan nått max antal heat (${limit}) enligt reglerna.`
      );
      return;
    }

    // Max 1 taktisk per heat (oavsett lag). Tillåtet att ändra om det är samma gate.
    const heatKey = `${currentMatch.id}#${heatNumber}`;
    const picked = tacticalByHeat?.[heatKey];
    if (picked && !(picked.team === team && picked.gate === gate)) {
      alert("Det finns redan en taktisk reserv satt i detta heat.");
      return;
    }

    // Om du vill tillåta endast 1 taktisk per LAG per MATCH (stramare regel än texten):
    // if (tacticalUsed[team]) { alert("Laget har redan använt taktisk reserv i matchen."); return; }

    try {
      await updateHeatRiders(currentMatch.id, heatNumber, assignments);

      // Uppdatera namn så UI visar direkt
      const selected = (ridersByTeam[team] || []).find(
        (r) => String(r.id) === String(newRiderId)
      );
      const newName = selected ? selected.name : oldGateObj?.name;

      setCurrentMatch((prev) => {
        const updatedHeats = prev.heats.map((h) => {
          if (h.heat_number !== heatNumber) return h;
          return {
            ...h,
            riders: {
              ...h.riders,
              [gate]: {
                ...h.riders[gate],
                rider_id: newRiderId,
                name: newName,
              },
              // markera heatet som taktiskt (för badge)
            },
            is_tactical_heat: true,
          };
        });
        return { ...prev, heats: updatedHeats };
      });

      // Markera “en taktisk i detta heat”
      setTacticalByHeat((prev) => ({
        ...prev,
        [heatKey]: { team, gate, riderId: newRiderId },
      }));

      // OM du vill tillåta endast 1 per lag per match (stramare):
      // setTacticalUsed((prev) => ({ ...prev, [team]: true }));
    } catch (err) {
      alert(err.message);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadTeams();
    loadMatches();

    // Check for stored auth token
    const token = localStorage.getItem("speedway_token");
    const userData = localStorage.getItem("speedway_user");
    if (token && userData) {
      setUser(JSON.parse(userData));
      loadUserMatches();
    }
  }, []);

  // Load user matches when user logs in
  useEffect(() => {
    if (user) {
      loadUserMatches();
    }
  }, [user]);

  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem("speedway_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "API Error");
    }

    return response.json();
  };

  const loadTeams = async () => {
    try {
      const data = await apiCall("/api/teams");
      setTeams(data);
      console.log(data);
    } catch (error) {
      console.error("Error loading teams:", error);
    }
  };

  const loadMatches = async () => {
    try {
      const data = await apiCall("/api/matches");
      setMatches(data);
    } catch (error) {
      console.error("Error loading matches:", error);
    }
  };

  const loadUserMatches = async () => {
    try {
      const data = await apiCall("/api/user/matches");
      setUserMatches(data);
    } catch (error) {
      console.error("Error loading user matches:", error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiCall("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      localStorage.setItem("speedway_token", response.token);
      localStorage.setItem("speedway_user", JSON.stringify(response.user));
      setUser(response.user);
      setShowAuthDialog(false);
      setLoginForm({ username: "", password: "" });
      loadUserMatches();
    } catch (error) {
      alert("Inloggning misslyckades: " + error.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiCall("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });

      localStorage.setItem("speedway_token", response.token);
      localStorage.setItem("speedway_user", JSON.stringify(response.user));
      setUser(response.user);
      setShowAuthDialog(false);
      setRegisterForm({ username: "", email: "", password: "" });
      loadUserMatches();
    } catch (error) {
      alert("Registrering misslyckades: " + error.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("speedway_token");
    localStorage.removeItem("speedway_user");
    setUser(null);
    setCurrentMatch(null);
    setUserMatches([]);
  };

  // DENNA PLUS createFromOfficialAndStart är NYA FUNKTIONER ----------------------------------------------------------NYTT
  const createMatch = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Du måste vara inloggad för att skapa matcher");
      return;
    }
    const chosen = new Date(matchForm.date);
    // if (!isSameDay(chosen, new Date())) {
    //   alert("Du kan bara skapa protokoll för matcher med datum = idag.");
    //   return;
    // }
    if (!matchForm.home_team_id || !matchForm.away_team_id) {
      alert("Välj både hemma- och bortalag.");
      return;
    }

    setLoading(true);
    try {
      await apiCall("/api/matches", {
        method: "POST",
        body: JSON.stringify(matchForm),
      });
      alert("Match skapad med förbestämda 15 heat!");
      setMatchForm({ home_team_id: "", away_team_id: "", date: "", venue: "" });
      setSelectedOfficialId(null);
      loadMatches();
    } catch (error) {
      alert("Kunde inte skapa match: " + error.message);
    }
    setLoading(false);
  };

  const openHeatResult = (heat) => {
    setCurrentHeat(heat);
    setEditingHeat(null);
    initializeHeatForm(heat);
  };

  const editHeatResult = (heat) => {
    setEditingHeat(heat);
    setCurrentHeat(heat);
    initializeHeatForm(heat);
  };

  const initializeHeatForm = (heat) => {
    const initialResults = {};
    Object.keys(heat.riders).forEach((gate) => {
      const rider = heat.riders[gate];
      const existingResult = heat.results?.find(
        (r) => r.rider_id === rider.rider_id
      );

      initialResults[rider.rider_id] = {
        position: existingResult?.position?.toString() || "",
        status: existingResult?.status || "completed",
      };
    });
    setHeatResults(initialResults);
  };

  function updateHeatResult(riderId, field, value) {
    setHeatResults((prev) => ({
      ...prev,
      [riderId]: { ...prev[riderId], [field]: value },
    }));
  }

  // Ny: toggla unik position 1–4
  function togglePosition(riderId, pos) {
    setHeatResults((prev) => {
      const current = prev[riderId]?.position;
      const isTogglingOff = String(current) === String(pos);

      // Starta från en kopia
      const next = { ...prev };

      if (isTogglingOff) {
        // Klickade samma pos igen ⇒ avmarkera
        next[riderId] = { ...next[riderId], position: "" };
        return next;
      }

      // Annars: tilldela pos till riderId och ta bort den från andra
      Object.keys(next).forEach((otherId) => {
        if (
          otherId !== riderId &&
          String(next[otherId]?.position) === String(pos)
        ) {
          next[otherId] = { ...next[otherId], position: "" };
        }
      });

      next[riderId] = { ...next[riderId], position: pos };
      return next;
    });
  }

  const submitHeatResult = async () => {
    if (!currentHeat || !currentMatch) return;
    setLoading(true);
    try {
      const results = Object.keys(heatResults).map((riderId) => ({
        rider_id: riderId,
        position: parseInt(heatResults[riderId].position) || 0,
        status: heatResults[riderId].status,
      }));

      // 1) Töm heatets resultat först (workaround om backend adderar)
      await apiCall(
        `/api/matches/${currentMatch.id}/heat/${currentHeat.heat_number}/result`,
        { method: "PUT", body: JSON.stringify({ results: [] }) }
      );

      // 2) Skriv in nya resultat
      await apiCall(
        `/api/matches/${currentMatch.id}/heat/${currentHeat.heat_number}/result`,
        { method: "PUT", body: JSON.stringify({ results }) }
      );

      // Hämta om
      const updatedMatch = await apiCall(`/api/matches/${currentMatch.id}`);
      setCurrentMatch(updatedMatch);
      setCurrentHeat(null);
      setEditingHeat(null);
      alert("Heat resultat sparat!");
    } catch (error) {
      alert("Kunde inte spara resultat: " + error.message);
    }
    setLoading(false);
  };

  const confirmMatch = async () => {
    if (!currentMatch) return;

    setLoading(true);
    try {
      const response = await apiCall(
        `/api/matches/${currentMatch.id}/confirm`,
        {
          method: "PUT",
        }
      );

      setConfirmationResult(response);
      setShowConfirmDialog(true);
      loadUserMatches();
      localStorage.removeItem("active_match_id"); // 🧹 RENSAR

      // Uppdatera state
      // const updatedMatch = await apiCall(`/api/matches/${currentMatch.id}`);  //KOMMENTERA BORT
      // setCurrentMatch(updatedMatch);                                          //KOMMENTERA BORT
      // Töm aktiv match
      setCurrentMatch(null);
      localStorage.removeItem("active_match_id");
    } catch (error) {
      alert("Kunde inte bekräfta match: " + error.message);
    }
    setLoading(false);
  };

  const resolveDiscrepancy = async (userMatchId, action) => {
    setLoading(true);
    try {
      await apiCall(`/api/user/matches/${userMatchId}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ action }),
      });

      loadUserMatches();
      alert("Konflikt löst!");
    } catch (error) {
      alert("Kunde inte lösa konflikt: " + error.message);
    }
    setLoading(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600">Genomförd</Badge>;
      case "excluded":
        return <Badge className="bg-red-600">Utesluten</Badge>;
      case "upcoming":
        return <Badge variant="secondary">Kommande</Badge>;
      default:
        return <Badge variant="secondary">Okänd</Badge>;
    }
  };

  const getRiderGateStyle = (team, gate) => {
    // Home team: Red (gates 1,3), Blue (gates 2,4 when away)
    // Away team: Yellow (gates 2,4), White when visible
    if (team === "home") {
      return gate === "1" || gate === "3"
        ? "border-l-4 border-red-600 bg-red-50"
        : "border-l-4 border-blue-600 bg-blue-50";
    } else {
      return gate === "2" || gate === "4"
        ? "border-l-4 border-yellow-500 bg-yellow-50"
        : "border-l-4 border-gray-300 bg-gray-50";
    }
  };

  const completedHeats = currentMatch
    ? currentMatch.heats?.filter((h) => h.status === "completed").length || 0
    : 0;
  const canConfirmMatch = completedHeats === 15;

  // Officiella matcher (endast idag) ------------------------------------------------------------------------------------- NYTT
  const [officialToday, setOfficialToday] = useState([]);
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const [selectedOfficial, setSelectedOfficial] = useState(null);

  // Ladda officiella matcher (endast idag) när användaren är inloggad ------------------
  useEffect(() => {
    const loadOfficial = async () => {
      const token = localStorage.getItem("speedway_token");
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/official-matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const all = await res.json();

        // === NORMAL: dagens matcher ===
        // const today = new Date();
        // const onlyToday = (all || []).filter((m) =>
        //   isSameDay(new Date(m.date), today)
        // );

        // === TESTMODE: visa alla matcher ===
        const onlyToday = all; // visar ALLA matcher för test

        onlyToday.sort((a, b) => new Date(a.date) - new Date(b.date));
        setOfficialToday(onlyToday);
      } catch (e) {
        console.error("Failed to load official matches:", e);
      }
    };
    if (user) loadOfficial();
  }, [user]);

  function normalizeName(name) {
    return (name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD") // separerar accenttecken
      .replace(/[\u0300-\u036f]/g, ""); // tar bort accenttecken
  }

  // const onSelectOfficial = async (id) => {
  //   setSelectedOfficialId(id);
  //   const m = officialToday.find((x) => x.id === id);
  //   setSelectedOfficial(m || null);
  //   if (!m) return;

  //   // 1) Mappa lag-namn till DB-id
  //   const homeNorm = normalizeName(
  //     teamAlias[normalizeName(m.home_team)] || m.home_team
  //   );
  //   const awayNorm = normalizeName(
  //     teamAlias[normalizeName(m.away_team)] || m.away_team
  //   );

  //   const homeId = teamIdByName.get(homeNorm) || "";
  //   const awayId = teamIdByName.get(awayNorm) || "";

  //   if (!homeId || !awayId) {
  //     alert(
  //       "Kunde inte matcha lag mot din databas. Välj ett annat eller komplettera alias-tabellen."
  //     );
  //     return;
  //   }

  //   // 2) Skapa match
  //   try {
  //     const payload = {
  //       home_team_id: homeId,
  //       away_team_id: awayId,
  //       date: m.date, // ISO från scraping
  //       venue: "", // valfritt (kan lämnas tomt)
  //       official_match_id: m.id, // <-- nyckel för koppling
  //     };
  //     const res = await apiCall("/api/matches", {
  //       method: "POST",
  //       body: JSON.stringify(payload),
  //     });

  //     // 3) Hämta full match för visning
  //     const created = await apiCall(`/api/matches/${res.match_id}`);

  //     // 4) Lägg till överst i listan
  //     setMatches((prev) => [created, ...prev]);

  //     // 5) Spara aktiv match i localStorage
  //     localStorage.setItem("active_match_id", created.id);
  //     setCurrentMatch(created);
  //     setActiveTab("protokoll");
  //     // 5) Töm val (valfritt)
  //     // setSelectedOfficialId(null);
  //     // setSelectedOfficial(null);
  //   } catch (e) {
  //     alert("Kunde inte skapa match: " + e.message);
  //   }
  // };

  const onSelectOfficial = async (id) => {
    setSelectedOfficialId(id);
    const m = officialToday.find((x) => x.id === id);
    setSelectedOfficial(m || null);
    if (!m) return;

    try {
      // 1) Skapa match på backend utifrån official_match_id
      const res = await apiCall("/api/matches/from-official", {
        method: "POST",
        body: JSON.stringify({ official_match_id: m.id }),
      });

      // 2) Hämta full match för visning
      const created = await apiCall(`/api/matches/${res.match_id}`);

      // 3) Lägg till överst i listan och gör den aktiv
      setMatches((prev) => [created, ...prev]);
      localStorage.setItem("active_match_id", created.id);
      setCurrentMatch(created);
      setActiveTab("protokoll");
    } catch (e) {
      alert("Kunde inte skapa match från official: " + e.message);
    }
  };

  const deleteMatchById = async (id) => {
    if (!window.confirm("Ta bort matchen?")) return;
    try {
      await apiCall(`/api/matches/${id}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });

      setMatches((prev) => prev.filter((m) => m.id !== id));

      if (currentMatch?.id === id) {
        localStorage.removeItem("active_match_id");
        setCurrentMatch(null);
      }
    } catch (e) {
      alert("Kunde inte ta bort match: " + e.message);
    }
  };

  const startMatchById = async (id) => {
    try {
      const matchData = await apiCall(`/api/matches/${id}`);
      setCurrentMatch(matchData);
      setActiveTab("protokoll");
    } catch (e) {
      alert("Kunde inte ladda match: " + e.message);
    }
  };

  useEffect(() => {
    const storedMatchId = localStorage.getItem("active_match_id");
    if (storedMatchId && user) {
      apiCall(`/api/matches/${storedMatchId}`)
        .then((match) => {
          setCurrentMatch(match);
          setActiveTab("protokoll");
        })
        .catch(() => {
          localStorage.removeItem("active_match_id");
        });
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b-4 border-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Speedway Elitserien
                </h1>
                <p className="text-gray-600">Professionellt Matchprotokoll</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">Hej, {user.username}!</span>
                  <Button onClick={handleLogout} variant="outline">
                    Logga ut
                  </Button>
                </div>
              ) : (
                <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700">
                      Logga in
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {authMode === "login" ? "Logga in" : "Skapa konto"}
                      </DialogTitle>
                      <DialogDescription>
                        {authMode === "login"
                          ? "Logga in för att föra matchprotokoll"
                          : "Skapa ett nytt konto för att komma igång"}
                      </DialogDescription>
                    </DialogHeader>

                    <Tabs value={authMode} onValueChange={setAuthMode}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Logga in</TabsTrigger>
                        <TabsTrigger value="register">Registrera</TabsTrigger>
                      </TabsList>

                      <TabsContent value="login">
                        <form onSubmit={handleLogin} className="space-y-4 mt-4">
                          <div>
                            <Label htmlFor="username">Användarnamn</Label>
                            <Input
                              id="username"
                              value={loginForm.username}
                              onChange={(e) =>
                                setLoginForm({
                                  ...loginForm,
                                  username: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="password">Lösenord</Label>
                            <Input
                              id="password"
                              type="password"
                              value={loginForm.password}
                              onChange={(e) =>
                                setLoginForm({
                                  ...loginForm,
                                  password: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-red-600 hover:bg-red-700"
                            disabled={loading}
                          >
                            {loading ? "Loggar in..." : "Logga in"}
                          </Button>
                        </form>
                      </TabsContent>

                      <TabsContent value="register">
                        <form
                          onSubmit={handleRegister}
                          className="space-y-4 mt-4"
                        >
                          <div>
                            <Label htmlFor="reg-username">Användarnamn</Label>
                            <Input
                              id="reg-username"
                              value={registerForm.username}
                              onChange={(e) =>
                                setRegisterForm({
                                  ...registerForm,
                                  username: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">E-post</Label>
                            <Input
                              id="email"
                              type="email"
                              value={registerForm.email}
                              onChange={(e) =>
                                setRegisterForm({
                                  ...registerForm,
                                  email: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="reg-password">Lösenord</Label>
                            <Input
                              id="reg-password"
                              type="password"
                              value={registerForm.password}
                              onChange={(e) =>
                                setRegisterForm({
                                  ...registerForm,
                                  password: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-red-600 hover:bg-red-700"
                            disabled={loading}
                          >
                            {loading ? "Skapar konto..." : "Skapa konto"}
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="seriespel">
              <Trophy className="w-4 h-4 mr-2" />
              Seriespel
            </TabsTrigger>
            <TabsTrigger value="matcher">
              <Calendar className="w-4 h-4 mr-2" />
              Matcher
            </TabsTrigger>
            <TabsTrigger value="protokoll">
              <Target className="w-4 h-4 mr-2" />
              Matchprotokoll
            </TabsTrigger>
            {user && (
              <TabsTrigger value="mina-matcher">
                <Users className="w-4 h-4 mr-2" />
                Mina matcher
              </TabsTrigger>
            )}
          </TabsList>

          {/* League Standings */}
          <TabsContent value="seriespel">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                  Elitserien Tabell
                </CardTitle>
                <CardDescription>
                  Aktuell ställning i Speedway Elitserien
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Pos</th>
                        <th className="text-left py-3 px-4">Lag</th>
                        <th className="text-left py-3 px-4">Stad</th>
                        <th className="text-right py-3 px-4">Matcher</th>
                        <th className="text-right py-3 px-4">Poäng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team, index) => (
                        <tr key={team.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">
                            {index + 1}
                            {index === 0 && (
                              <Trophy className="w-4 h-4 inline ml-2 text-yellow-600" />
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {team.name}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {team.city}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {team.matches_played}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge
                              variant={index < 3 ? "default" : "secondary"}
                            >
                              {team.points}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matcher">
            <div className="grid gap-6">
              {user && (
                <Card>
                  <CardHeader>
                    <CardTitle>Välj officiell match (idag)</CardTitle>
                    <CardDescription>
                      Välj från listan för att skapa din match
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Label>Officiella matcher</Label>
                      <Select
                        value={selectedOfficialId ?? undefined}
                        onValueChange={onSelectOfficial}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              officialToday.length
                                ? "Välj match…"
                                : "Inga officiella matcher idag"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {officialToday.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.home_team} vs {m.away_team} •{" "}
                              {new Date(m.date).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedOfficial && (
                        <div className="mt-2 text-sm text-gray-600">
                          Vald: <strong>{selectedOfficial.home_team}</strong> vs{" "}
                          <strong>{selectedOfficial.away_team}</strong> •{" "}
                          {new Date(selectedOfficial.date).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Skapade matcher (idag)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {matches
                      // .filter(
                      //   (m) =>
                      //     user &&
                      //     m.created_by === user.id &&
                      //     isSameDay(new Date(m.date), new Date())
                      // )
                      .filter((m) => user && m.created_by === user.id)
                      .map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div className="text-lg font-semibold">
                                {match.home_team} vs {match.away_team}
                              </div>
                              <Badge
                                variant={
                                  match.status === "confirmed"
                                    ? "default"
                                    : match.status === "completed"
                                    ? "secondary"
                                    : match.status === "live"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {match.status === "confirmed"
                                  ? "Bekräftad"
                                  : match.status === "completed"
                                  ? "Avslutad"
                                  : match.status === "live"
                                  ? "Live"
                                  : "Kommande"}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {formatDate(match.date)}{" "}
                              {match.venue ? `• ${match.venue}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => {
                                localStorage.setItem(
                                  "active_match_id",
                                  match.id
                                );
                                setCurrentMatch(match);
                                setActiveTab("protokoll");
                              }}
                              size="sm"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              {match.heats.some((h) => h.results?.length > 0)
                                ? "Återuppta protokoll"
                                : "Starta protokoll"}
                            </Button>
                            <Button
                              onClick={() => deleteMatchById(match.id)}
                              size="sm"
                              variant="destructive"
                            >
                              Ta bort
                            </Button>
                          </div>
                        </div>
                      ))}
                    {/* Om tomt */}
                    {matches.filter(
                      (m) =>
                        user &&
                        m.created_by === user.id &&
                        isSameDay(new Date(m.date), new Date())
                    ).length === 0 && (
                      <p className="text-gray-500 text-center py-8">
                        Inga skapade matcher idag ännu
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Match Protocol */}
          <TabsContent value="protokoll">
            {!currentMatch ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="w-16 h-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Inget matchprotokoll aktivt
                  </h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Välj en match från fliken "Matcher" för att börja föra
                    protokoll
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Match Header */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center justify-between">
                      <span>
                        {currentMatch.home_team} vs {currentMatch.away_team}
                      </span>
                      {user &&
                        canConfirmMatch &&
                        currentMatch.status !== "confirmed" && (
                          <Button
                            onClick={confirmMatch}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={loading}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {loading ? "Bekräftar..." : "Bekräfta match"}
                          </Button>
                        )}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(currentMatch.date)} • {currentMatch.venue} •{" "}
                      {completedHeats}/15 Heat komplett
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-8 text-center">
                      {/* <HeatRow/> */}
                      <div>
                        <div className="text-4xl font-bold text-red-600">
                          {currentMatch.home_score}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {currentMatch.home_team}
                        </div>
                        <div className="flex justify-center space-x-1 mb-2">
                          <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                        </div>
                      </div>
                      <div>
                        <div className="text-lg text-gray-400">-</div>
                        <Badge
                          variant={
                            currentMatch.status === "confirmed"
                              ? "default"
                              : currentMatch.status === "live"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {currentMatch.status === "confirmed"
                            ? "Bekräftad"
                            : currentMatch.status === "live"
                            ? "Pågår"
                            : "Kommande"}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-yellow-600">
                          {currentMatch.away_score}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {currentMatch.away_team}
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
                      {currentMatch.heats?.map((heat) => {
                        // Beräkna bonuspoäng för heatet
                        const bonuses = computeHeatBonuses(heat);
                        return (
                          <div
                            key={heat.heat_number}
                            className="border rounded-lg p-4 hover:bg-gray-50"
                          >
                            {/* Header med heatnummer och status/taktisk indikator */}
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">
                                Heat {heat.heat_number}
                              </h4>
                              <div className="flex items-center space-x-2">
                                {heat.is_tactical_heat && (
                                  <Badge className="bg-orange-500">
                                    <Zap className="w-3 h-3 mr-1" /> Taktisk
                                  </Badge>
                                )}
                                {getStatusBadge(heat.status)}
                              </div>
                            </div>
                            {(() => {
                              const diff = Math.abs(
                                currentMatch.home_score -
                                  currentMatch.away_score
                              );
                              if (heat.status !== "upcoming" || diff < 8)
                                return null;

                              const underTeam =
                                currentMatch.home_score <
                                currentMatch.away_score
                                  ? "home"
                                  : currentMatch.away_score <
                                    currentMatch.home_score
                                  ? "away"
                                  : null;

                              if (!underTeam) return null;

                              const key = heatKeyOf(
                                currentMatch.id,
                                heat.heat_number
                              );
                              const currentChoice = laneChoiceByHeat[key]; // ev. { team, pair }

                              // Små knappar: "1 & 3" / "2 & 4" + Återställ
                              return (
                                <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-amber-800">
                                      {underTeam === "home"
                                        ? currentMatch.home_team
                                        : currentMatch.away_team}
                                    </span>
                                    <span className="text-amber-800">
                                      ligger under (≥8): välj startspår
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      className={`px-2 py-1 rounded border ${
                                        currentChoice?.pair === "13" &&
                                        currentChoice?.team === underTeam
                                          ? "bg-blue-600 text-white"
                                          : "bg-white hover:bg-gray-100"
                                      }`}
                                      onClick={() =>
                                        applyLaneChoiceToHeat(
                                          heat.heat_number,
                                          underTeam,
                                          "13"
                                        )
                                      }
                                      title="Välj bana 1 & 3"
                                    >
                                      1 & 3
                                    </button>
                                    <button
                                      type="button"
                                      className={`px-2 py-1 rounded border ${
                                        currentChoice?.pair === "24" &&
                                        currentChoice?.team === underTeam
                                          ? "bg-blue-600 text-white"
                                          : "bg-white hover:bg-gray-100"
                                      }`}
                                      onClick={() =>
                                        applyLaneChoiceToHeat(
                                          heat.heat_number,
                                          underTeam,
                                          "24"
                                        )
                                      }
                                      title="Välj bana 2 & 4"
                                    >
                                      2 & 4
                                    </button>
                                    {currentChoice && (
                                      <button
                                        type="button"
                                        className="ml-1 px-2 py-1 rounded border bg-white hover:bg-gray-100"
                                        onClick={() =>
                                          restoreOriginalRidersForHeat(
                                            heat.heat_number
                                          )
                                        }
                                        title="Återställ till ursprungliga startspår"
                                      >
                                        Återställ
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Heatets fyra förare */}
                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                              {Object.keys(heat.riders)
                                .sort()
                                .map((gate) => {
                                  const rider = heat.riders[gate];
                                  const result = heat.results?.find(
                                    (r) => r.rider_id === rider.rider_id
                                  );
                                  const bonus = bonuses[rider.rider_id] || 0;
                                  const team = rider.team; // "home" eller "away"
                                  const options = ridersByTeam[team] || [];

                                  return (
                                    <div
                                      key={gate}
                                      className={`text-center p-2 rounded ${getRiderGateStyle(
                                        rider.team,
                                        gate
                                      )}`}
                                    >
                                      {/* Visa gate‑nummer och hjälmfärg */}
                                      <div className="flex items-center justify-center space-x-1">
                                        <span className="w-5 h-5 bg-gray-200 rounded-full text-xs flex items-center justify-center">
                                          {gate}
                                        </span>
                                        <div
                                          className="w-3 h-3 rounded-full border"
                                          style={{
                                            backgroundColor: rider.helmet_color,
                                            borderColor:
                                              rider.helmet_color === "#FFFFFF"
                                                ? "#ccc"
                                                : rider.helmet_color,
                                          }}
                                        ></div>
                                      </div>

                                      {/* Förarnamn eller valbar lista om taktisk reserv tillåten */}
                                      <div className="font-medium text-xs mt-1">
                                        {/* Always display the rider name here.  Tactical reserve changes are managed via the heat result dialog. */}
                                        {rider.name}
                                      </div>

                                      {/* Resultat med poäng + bonus eller utesluten */}
                                      {result && (
                                        <div className="mt-1">
                                          {result.status === "completed" && (
                                            <Badge
                                              className={`text-xs ${getPositionColor(
                                                result.position
                                              )}`}
                                            >
                                              {result.position}. (
                                              {result.points}
                                              {bonus ? `+${bonus}` : ""} p)
                                            </Badge>
                                          )}
                                          {result.status === "excluded" && (
                                            <Badge className="text-xs bg-red-600">
                                              <AlertTriangle className="w-3 h-3" />
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>

                            {/* Knappar för att registrera eller redigera heatresultat */}
                            {user && (
                              <div className="flex space-x-2">
                                {heat.status === "upcoming" && (
                                  <Button
                                    onClick={() => openHeatResult(heat)}
                                    size="sm"
                                    className="flex-1"
                                  >
                                    Registrera resultat
                                  </Button>
                                )}
                                {heat.status === "completed" &&
                                  currentMatch.status !== "confirmed" && (
                                    <Button
                                      onClick={() => editHeatResult(heat)}
                                      size="sm"
                                      variant="outline"
                                      className="flex-1"
                                    >
                                      Redigera
                                    </Button>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* User Matches */}
          {/* User Matches */}
          {user && (
            <TabsContent value="mina-matcher">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Mina matcher
                  </CardTitle>
                  <CardDescription>
                    Matcher du har fyllt i protokoll för
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userMatches.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        Du har inte fyllt i några matcher än
                      </p>
                    ) : (
                      userMatches.map((userMatch) => {
                        const {
                          match_details,
                          user_results,
                          official_results,
                          discrepancies,
                          status,
                        } = userMatch;

                        return (
                          <div
                            key={userMatch.id}
                            className="border rounded-lg p-4"
                          >
                            {/* Toppsektion */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-4">
                                <div className="font-semibold">
                                  {match_details?.home_team} vs{" "}
                                  {match_details?.away_team}
                                </div>
                                <Badge
                                  variant={
                                    status === "validated"
                                      ? "default"
                                      : status === "disputed"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {status === "validated"
                                    ? "Validerad"
                                    : status === "disputed"
                                    ? "Konflikt"
                                    : "Komplett"}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">
                                  {user_results?.home_score} -{" "}
                                  {user_results?.away_score}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(match_details?.date)}
                                </div>
                              </div>
                            </div>

                            {/* Avvikelser */}
                            {discrepancies && discrepancies.length > 0 && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <div className="flex items-center mb-2">
                                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                                  <span className="font-medium text-yellow-800">
                                    Avvikelser upptäckta
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  {discrepancies.map((disc, index) => (
                                    <div
                                      key={`${disc.type}-${index}`}
                                      className="flex justify-between"
                                    >
                                      <span>
                                        {disc.type === "home_score"
                                          ? "Hemmalag poäng"
                                          : "Bortalag poäng"}
                                        :
                                      </span>
                                      <span>
                                        Du: {disc.user_value} | Officiellt:{" "}
                                        {disc.official_value}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Knappar */}
                                <div className="flex space-x-2 mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      resolveDiscrepancy(
                                        userMatch.id,
                                        "accept_official"
                                      )
                                    }
                                    disabled={loading}
                                  >
                                    Acceptera officiellt
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      resolveDiscrepancy(
                                        userMatch.id,
                                        "keep_user"
                                      )
                                    }
                                    disabled={loading}
                                  >
                                    Behåll mitt
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Officiellt resultat visas även om ingen konflikt */}
                            {official_results && discrepancies.length === 0 && (
                              <div className="mt-2 text-sm text-gray-600">
                                Officiellt resultat:{" "}
                                <span className="font-medium">
                                  {official_results.home_score} -{" "}
                                  {official_results.away_score}
                                </span>{" "}
                                (från {official_results.source || "källa okänd"}
                                )
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* {user && (
            <TabsContent value="mina-matcher">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Mina matcher
                  </CardTitle>
                  <CardDescription>
                    Matcher du har fyllt i protokoll för
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userMatches.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        Du har inte fyllt i några matcher än
                      </p>
                    ) : (
                      userMatches.map((userMatch) => (
                        <div
                          key={userMatch.id}
                          className="border rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-4">
                              <div className="font-semibold">
                                {userMatch.match_details?.home_team} vs{" "}
                                {userMatch.match_details?.away_team}
                              </div>
                              <Badge
                                variant={
                                  userMatch.status === "validated"
                                    ? "default"
                                    : userMatch.status === "disputed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {userMatch.status === "validated"
                                  ? "Validerad"
                                  : userMatch.status === "disputed"
                                  ? "Konflikt"
                                  : "Komplett"}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {userMatch.user_results.home_score} -{" "}
                                {userMatch.user_results.away_score}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(userMatch.completed_at)}
                              </div>
                            </div>
                          </div>

                          {userMatch.discrepancies &&
                            userMatch.discrepancies.length > 0 && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <div className="flex items-center mb-2">
                                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                                  <span className="font-medium text-yellow-800">
                                    Avvikelser upptäckta
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  {userMatch.discrepancies.map(
                                    (disc, index) => (
                                      <div
                                      key={`${disc.type}-${index}`}
                                        className="flex justify-between"
                                      >
                                        <span>
                                          {disc.type === "home_score"
                                            ? "Hemmalag poäng"
                                            : "Bortalag poäng"}
                                          :
                                        </span>
                                        <span>
                                          Du: {disc.user_value} | Officiellt:{" "}
                                          {disc.official_value}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                                <div className="flex space-x-2 mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      resolveDiscrepancy(
                                        userMatch.id,
                                        "accept_official"
                                      )
                                    }
                                    disabled={loading}
                                  >
                                    Acceptera officiellt
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      resolveDiscrepancy(
                                        userMatch.id,
                                        "keep_user"
                                      )
                                    }
                                    disabled={loading}
                                  >
                                    Behåll mitt
                                  </Button>
                                </div>
                              </div>
                            )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )} */}
        </Tabs>

        {currentHeat && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setCurrentHeat(null);
                setEditingHeat(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingHeat ? "Redigera" : "Registrera"} Heat{" "}
                  {currentHeat.heat_number} Resultat
                </DialogTitle>
                <DialogDescription>
                  {editingHeat
                    ? "Redigera placering och status för varje förare"
                    : "Registrera placering och status för varje förare"}
                </DialogDescription>
              </DialogHeader>

              {(() => {
                // Nyckel för “en taktisk reserv per heat”
                const heatKey = `${currentMatch.id}#${currentHeat.heat_number}`;
                const someonePickedThisHeat = Boolean(
                  tacticalByHeat?.[heatKey]
                );

                // Hämta “live”-heat från currentMatch så att selecten visar rätt direkt
                const liveHeat =
                  currentMatch?.heats?.find(
                    (h) => h.heat_number === currentHeat.heat_number
                  ) || currentHeat;

                return Object.keys(liveHeat.riders)
                  .sort()
                  .map((gate) => {
                    const rider = liveHeat.riders[gate]; // live gate state
                    const res = heatResults[rider.rider_id] || {
                      position: "",
                      status: "completed",
                    };
                    const team = rider.team;

                    const availableOptions = (ridersByTeam[team] || []).filter(
                      (opt) => !toppedRiders.includes(opt.id)
                    );

                    // Visa dropdown bara om:
                    // - heat 5–13
                    // - laget får toppa (ligger under & ej använt tidigare)
                    // - ingen annan har redan valt taktiskt i detta heat
                    //   (eller: det är samma gate som redan valt taktiskt → tillåtet att ändra/ångra)
                    const allowTactical =
                      currentHeat.heat_number >= TACTICAL_START_HEAT &&
                      currentHeat.heat_number <= TACTICAL_END_HEAT &&
                      canUseTactical(team) &&
                      (!someonePickedThisHeat ||
                        (tacticalByHeat?.[heatKey]?.team === team &&
                          tacticalByHeat?.[heatKey]?.gate === gate));

                    return (
                      <div key={gate} className="border rounded-md p-3 mb-3">
                        <div className="font-medium mb-2">
                          Gate {gate}:{" "}
                          {allowTactical ? (
                            <select
                              value={rider.rider_id}
                              onChange={(e) =>
                                handleChangeRider(currentHeat.heat_number, {
                                  [gate]: e.target.value,
                                })
                              }
                              className="text-xs"
                            >
                              {availableOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{rider.name}</span>
                          )}
                        </div>

                        <div className="flex space-x-4">
                          <div>
                            <label className="text-sm mr-1 block mb-1">
                              Placering:
                            </label>
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4].map((pos) => {
                                const isSelected = Number(res.position) === pos;
                                return (
                                  <button
                                    key={pos}
                                    type="button"
                                    onClick={() =>
                                      setPositionExclusive(rider.rider_id, pos)
                                    }
                                    className={`px-2 py-1 rounded border text-sm transition ${
                                      isSelected
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 hover:bg-gray-300"
                                    }`}
                                    aria-pressed={isSelected}
                                  >
                                    {pos}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm mr-1">Status:</label>
                            <select
                              value={res.status}
                              onChange={(e) =>
                                updateHeatResult(
                                  rider.rider_id,
                                  "status",
                                  e.target.value
                                )
                              }
                              className="text-sm border rounded"
                            >
                              <option value="completed">Genomförd</option>
                              <option value="excluded">Utesluten</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  });
              })()}

              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentHeat(null);
                    setEditingHeat(null);
                  }}
                >
                  Avbryt
                </Button>
                <Button onClick={submitHeatResult} disabled={loading}>
                  {loading ? "Sparar..." : "Spara resultat"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Match Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Match bekräftad!</DialogTitle>
              <DialogDescription>
                Matchen har sparats i dina matcher.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {confirmationResult?.discrepancies &&
                confirmationResult.discrepancies.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                      <span className="font-medium text-yellow-800">
                        Avvikelser upptäckta mot officiella resultat
                      </span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Du kan granska och rätta detta i fliken "Mina matcher".
                    </p>
                  </div>
                )}
              <div className="flex justify-end">
                <Button onClick={() => setShowConfirmDialog(false)}>OK</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default App;
