// src/components/NominationDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { apiCall } from "@/api/client";

/**
 * Props:
 * - open: bool
 * - onClose: fn()
 * - match: { id, home_team_id, away_team_id, heats: [...] }
 * - onSaved: fn()  (kallas efter lyckad PUT och bör trigga reload)
 */
export default function NominationDialog({ open, onClose, match, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [riders, setRiders] = useState({ home: [], away: [] });
  const [pick14, setPick14] = useState({ home: [null, null], away: [null, null] });
  const [pick15, setPick15] = useState({ home: [null, null], away: [null, null] });
  const [error, setError] = useState("");

  // ------------- Helpers: poäng, counts, limits -------------
  const scoresByRider = useMemo(() => {
    const map = {};
    (match?.heats || []).forEach((h) => {
      (h.results || []).forEach((r) => {
        const rid = String(r.rider_id || "");
        const pts = Number(r.points || 0) + Number(r.bonus_points || 0);
        map[rid] = (map[rid] || 0) + pts;
      });
    });
    return map;
  }, [match]);

  const heatCountsNow = useMemo(() => {
    // hur många heat är rider uppsatt i (alla heat)
    const c = {};
    (match?.heats || []).forEach((h) => {
      Object.values(h.riders || {}).forEach((e) => {
        if (!e?.rider_id) return;
        const rid = String(e.rider_id);
        c[rid] = (c[rid] || 0) + 1;
      });
    });
    return c;
  }, [match]);

  const limitFor = (r) => (r?.is_reserve ? 5 : 6);

  // vilka IDs räknas som "top-3 ordinarie" (inkl. ties på 3:e plats)?
  const top3OfTeam = (team) => {
    const mains = (riders[team] || []).filter((r) => !r.is_reserve);
    const sorted = mains
      .slice()
      .sort((a, b) => (scoresByRider[String(b.id)] || 0) - (scoresByRider[String(a.id)] || 0));
    if (sorted.length <= 3) return new Set(sorted.map((r) => String(r.id)));
    const thirdScore = scoresByRider[String(sorted[2].id)] || 0;
    return new Set(sorted.filter((r) => (scoresByRider[String(r.id)] || 0) >= thirdScore).map((r) => String(r.id)));
  };

  // nuvarande ökningar från våra val (för limit-kollen)
  const increments = useMemo(() => {
    const inc = {};
    const add = (rid) => {
      if (!rid) return;
      const k = String(rid);
      inc[k] = (inc[k] || 0) + 1;
    };
    pick14.home.forEach(add);
    pick14.away.forEach(add);
    pick15.home.forEach(add);
    pick15.away.forEach(add);
    return inc;
  }, [pick14, pick15]);

  const wouldExceed = (rid) => {
    if (!rid) return false;
    const r =
      riders.home.find((x) => String(x.id) === String(rid)) ||
      riders.away.find((x) => String(x.id) === String(rid));
    if (!r) return false;
    const limit = limitFor(r);
    const current = heatCountsNow[String(rid)] || 0;
    const inc = increments[String(rid)] || 0;
    return current + inc > limit;
  };

  // ------------- Ladda trupper -------------
  useEffect(() => {
    if (!open || !match?.home_team_id || !match?.away_team_id) return;
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const [home, away] = await Promise.all([
          apiCall(`/api/teams/${match.home_team_id}/riders`),
          apiCall(`/api/teams/${match.away_team_id}/riders`),
        ]);
        if (cancelled) return;

        const toOpt = (xs) =>
          (xs || []).map((r) => ({
            id: String(r.id),
            name: r.name,
            is_reserve: !!r.is_reserve,
          }));

        setRiders({
          home: [...toOpt(home.mains || []), ...toOpt(home.reserves || [])],
          away: [...toOpt(away.mains || []), ...toOpt(away.reserves || [])],
        });
      } catch (e) {
        console.error(e);
        setError(e?.message || "Kunde inte ladda trupper");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, match?.home_team_id, match?.away_team_id]);

  // ------------- UI helpers -------------
  const renderSelect = (team, heat, slotIdx) => {
    // heat: 14 | 15
    // slotIdx: 0 | 1
    const picks = heat === 14 ? pick14 : pick15;
    const setPicks = heat === 14 ? setPick14 : setPick15;
    const otherIdx = slotIdx === 0 ? 1 : 0;
    const chosenOther = picks[team][otherIdx];

    const top3 = top3OfTeam(team); // används bara för heat 15 display/disable

    return (
      <select
        className="border rounded px-2 py-1 text-sm"
        value={picks[team][slotIdx] || ""}
        onChange={(e) => {
          const v = e.target.value || null;
          setPicks((prev) => {
            const next = { ...prev, [team]: [...prev[team]] };
            next[team][slotIdx] = v;
            return next;
          });
        }}
      >
        <option value="">— välj förare —</option>
        {(riders[team] || []).map((r) => {
          const id = String(r.id);
          const alreadyChosen = chosenOther && String(chosenOther) === id;
          // regler: heat 15 -> måste vara i top3 (ordinarie)
          const disallowedH15 = heat === 15 && !top3.has(id);
          const exceed = wouldExceed(id);

          const disabled = alreadyChosen || disallowedH15 || exceed;
          const score = scoresByRider[id] || 0;

          const labelParts = [
            r.name,
            r.is_reserve ? "(res)" : "",
            `poäng:${score}`,
            exceed ? "⛔️ limit" : "",
            heat === 15 && !disallowedH15 ? "✓ H15-tillåten" : heat === 15 ? "✕ ej top-3" : "",
          ].filter(Boolean);

          return (
            <option key={id} value={id} disabled={disabled}>
              {labelParts.join(" · ")}
            </option>
          );
        })}
      </select>
    );
  };

  // ------------- Spara -------------
  const canSubmit = useMemo(() => {
    const both14 =
      pick14.home[0] && pick14.home[1] && pick14.away[0] && pick14.away[1];
    const both15 =
      pick15.home[0] && pick15.home[1] && pick15.away[0] && pick15.away[1];
    // Du kan välja att kräva båda — eller tillåta endast en:
    return both14 || both15;
  }, [pick14, pick15]);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const body = {};
      // skicka bara de heaten som är kompletta
      if (pick14.home[0] && pick14.home[1] && pick14.away[0] && pick14.away[1]) {
        body.heat14 = { home: pick14.home, away: pick14.away };
      }
      if (pick15.home[0] && pick15.home[1] && pick15.away[0] && pick15.away[1]) {
        body.heat15 = { home: pick15.home, away: pick15.away };
      }
      await apiCall(`/api/matches/${match.id}/nominations`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Kunde inte spara nomineringar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose?.())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nomineringar – Heat 14 & 15</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Heat 14 */}
        <section className="mb-6">
          <div className="font-semibold mb-2">Heat 14 (fritt val)</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded">
              <div className="mb-2"><Badge>Home</Badge></div>
              <div className="space-y-2">
                {renderSelect("home", 14, 0)}
                {renderSelect("home", 14, 1)}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="mb-2"><Badge variant="secondary">Away</Badge></div>
              <div className="space-y-2">
                {renderSelect("away", 14, 0)}
                {renderSelect("away", 14, 1)}
              </div>
            </div>
          </div>
        </section>

        {/* Heat 15 */}
        <section className="mb-6">
          <div className="font-semibold mb-2">Heat 15 (2 av lagets top-3 ordinarie)</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded">
              <div className="mb-2"><Badge>Home</Badge></div>
              <div className="space-y-2">
                {renderSelect("home", 15, 0)}
                {renderSelect("home", 15, 1)}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="mb-2"><Badge variant="secondary">Away</Badge></div>
              <div className="space-y-2">
                {renderSelect("away", 15, 0)}
                {renderSelect("away", 15, 1)}
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Avbryt</Button>
          <Button onClick={onSubmit} disabled={!canSubmit || loading}>
            {loading ? "Sparar…" : "Spara nomineringar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
