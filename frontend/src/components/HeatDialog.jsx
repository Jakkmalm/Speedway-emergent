
// src/components/HeatDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Card } from "./ui/card";
import { isHeatCompleteFromForm } from "../hooks/useHeats";

// Ett säkert tomt heat (ingen hook här – konstant mellan renders)
const EMPTY_HEAT = {
  heat_number: 0,
  status: "upcoming",
  riders: {},
  results: [],
};

export default function HeatDialog({
  open,
  onOpenChange,
  match,
  heat, // kan vara null en kort stund
  ridersByTeam,
  canUseTactical, // (team) => boolean
  tacticalWindow, // { start: number, end: number }
  heatSwapGuard, // (liveHeat, draftRiders) => boolean  (true = ok)
  onSave, // async ({assignments, results}) => updatedMatch
}) {
  // Local state – hooks ska ALLTID köras oavsett om heat är null
  const [heatResults, setHeatResults] = useState({});
  const [draftHeat, setDraftHeat] = useState(null);

  const TACTICAL_START_HEAT = tacticalWindow?.start ?? 5;
  const TACTICAL_END_HEAT = tacticalWindow?.end ?? 13;

  // Säker referens så att downstream logik alltid har ett heat-objekt
  const safeHeat = heat ?? EMPTY_HEAT;

  // Hämta "liveHeat" från matchen om möjligt, annars fall tillbaka till safeHeat
  const liveHeat = useMemo(() => {
    if (!match || !safeHeat?.heat_number) return safeHeat;
    const found = match.heats?.find(
      (x) => x.heat_number === safeHeat.heat_number
    );
    return found || safeHeat;
  }, [match, safeHeat]);

  // Initiera formulär och draft när dialogen öppnas med ett faktiskt heat
  useEffect(() => {
    if (!open || !heat) return; // ok att avbryta – hooks har redan körts
    const initial = {};
    Object.keys(heat.riders || {})
      .sort()
      .forEach((gate) => {
        const rider = heat.riders[gate];
        const existing = heat.results?.find(
          (r) => String(r.rider_id) === String(rider.rider_id)
        );
        initial[rider.rider_id] = {
          position:
            existing?.position !== undefined && existing?.position !== null
              ? String(existing.position)
              : "",
          status: existing?.status || "completed",
        };
      });
    setHeatResults(initial);
    setDraftHeat(JSON.parse(JSON.stringify(heat)));
  }, [open, heat]);

  // Helpers (hooks-trygga)
  const setPositionExclusive = (riderId, pos) => {
    setHeatResults((prev) => {
      const already = parseInt(prev?.[riderId]?.position) === pos;
      const next = { ...prev };
      if (already) {
        next[riderId] = { ...(next[riderId] || {}), position: "" };
        return next;
      }
      Object.keys(next).forEach((id) => {
        if (id !== riderId && parseInt(next[id]?.position) === pos) {
          next[id] = { ...(next[id] || {}), position: "" };
        }
      });
      next[riderId] = { ...(next[riderId] || {}), position: pos };
      return next;
    });
  };

  const updateHeatResult = (riderId, field, value) => {
    setHeatResults((prev) => ({
      ...prev,
      [riderId]: { ...prev[riderId], [field]: value },
    }));
  };

  // Byt förare i "draft" (dropdown i dialogen)
  const setDraftRider = (gate, newRiderId) => {
    setDraftHeat((prev) => {
      const base = prev ?? liveHeat; // om prev är null, börja från liveHeat
      const next = JSON.parse(JSON.stringify(base));
      const team = next.riders?.[gate]?.team;
      if (!team) return prev; // gate saknas (borde ej ske)

      // const roster = ridersByTeam?.[team] || [];
      // TESTAR ANNARS TA TILLBAKA DEN ÖVER
      const roster = (ridersByTeam && ridersByTeam[team]) || [];

      const selected = roster.find((r) => String(r.id) === String(newRiderId));

      // Testa guard för hur många byten som tillåts
      const tempRiders = JSON.parse(JSON.stringify(next.riders));
      tempRiders[gate].rider_id = String(newRiderId);
      if (heatSwapGuard && !heatSwapGuard(liveHeat, tempRiders)) {
        return prev;
      }

      // Uppdatera draftens rider
      next.riders[gate].rider_id = String(newRiderId);
      next.riders[gate].name = selected?.name ?? next.riders[gate].name;

      // Synka formulärnycklar
      const oldId = String(base.riders[gate].rider_id);
      const newId = String(newRiderId);
      setHeatResults((f) => {
        const moved = { ...f };
        if (oldId !== newId) {
          if (moved[oldId]) {
            moved[newId] = { ...moved[oldId] };
            delete moved[oldId];
          } else {
            moved[newId] = moved[newId] || {
              position: "",
              status: "completed",
            };
          }
        }
        return moved;
      });

      return next;
    });
  };

  const dialogComplete = useMemo(
    () => isHeatCompleteFromForm(draftHeat || liveHeat, heatResults),
    [draftHeat, liveHeat, heatResults]
  );

  const ridersChanged = useMemo(() => {
    const h = draftHeat || liveHeat;
    for (const gate of Object.keys(liveHeat.riders || {})) {
      const beforeId = String(liveHeat.riders[gate]?.rider_id ?? "");
      const afterId = String(h.riders[gate]?.rider_id ?? "");
      if (beforeId !== afterId) return true;
    }
    return false;
  }, [draftHeat, liveHeat]);

  const resultsUnchanged = useMemo(() => {
    const persisted = {};
    Object.keys(liveHeat.riders || {})
      .sort()
      .forEach((gate) => {
        const rider = liveHeat.riders[gate];
        const existing = liveHeat.results?.find(
          (r) => String(r.rider_id) === String(rider.rider_id)
        );
        persisted[rider.rider_id] = {
          position:
            existing?.position !== undefined && existing?.position !== null
              ? String(existing.position)
              : "",
          status: existing?.status || "completed",
        };
      });
    const allIds = new Set([
      ...Object.keys(persisted),
      ...Object.keys(heatResults || {}),
    ]);
    for (const id of allIds) {
      const a = persisted[id] || { position: "", status: "completed" };
      const b = heatResults[id] || { position: "", status: "completed" };
      if (String(a.position) !== String(b.position)) return false;
      if (String(a.status) !== String(b.status)) return false;
    }
    return true;
  }, [liveHeat, heatResults]);

  const nothingChanged = !ridersChanged && resultsUnchanged;

  const handleSave = async () => {
    const h = draftHeat || liveHeat;

    const assignments = {};
    for (const gate of Object.keys(liveHeat.riders || {})) {
      const beforeId = String(liveHeat.riders[gate]?.rider_id ?? "");
      const afterId = String(h.riders[gate]?.rider_id ?? "");
      if (beforeId !== afterId) assignments[gate] = afterId;
    }

    const results = Object.keys(heatResults).map((riderId) => ({
      rider_id: riderId,
      position: parseInt(heatResults[riderId].position) || 0,
      status: heatResults[riderId].status,
    }));

    await onSave({ heat_number: liveHeat.heat_number, assignments, results });
    onOpenChange(false);
  };

  // === Render ===
  // Viktigt: vi har redan kört alla hooks. Nu kan vi villkora UI fritt.
  return (
    <Dialog className="bg-background" open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {liveHeat.status === "completed" ? "Redigera" : "Registrera"} Heat{" "}
            {liveHeat.heat_number} Resultat
          </DialogTitle>
          <DialogDescription>
            {liveHeat.status === "completed"
              ? "Redigera placering och status för varje förare"
              : "Registrera placering och status för varje förare"}
          </DialogDescription>
        </DialogHeader>

        {/* Laddläge om inga riders ännu */}
        {Object.keys((draftHeat || liveHeat).riders || {}).length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Laddar förare…</div>
        ) : (
          <>
            {Object.keys((draftHeat || liveHeat).riders)
              .sort()
              .map((gate) => {
                const h = draftHeat || liveHeat;
                const r = h.riders[gate];
                const team = r.team;
                const res = heatResults[r.rider_id] || {
                  position: "",
                  status: "completed",
                };

                const canPick =
                  (liveHeat.heat_number >= TACTICAL_START_HEAT &&
                    liveHeat.heat_number <= TACTICAL_END_HEAT &&
                    typeof canUseTactical === "function" &&
                    canUseTactical(team)) ||
                  false;

                return (
                  <Card key={gate} className="border rounded-md p-3 mb-3">
                    {/* <div className="font-medium mb-2">
                      Bana {gate} :{" "}
                      {canPick ? (
                        <select
                          value={r.rider_id}
                          onChange={(e) => setDraftRider(gate, e.target.value)}
                          className="text-xs"
                        >
                          {(ridersByTeam?.[team] || []).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{r.name}</span>
                      )}
                    </div> */}
                    <div className="font-medium mb-2">
                      Bana {gate}:{" "}
                      {canPick ? (
                        <Select
                          // se till att value är en sträng; fallback om det är tomt
                          value={r?.rider_id ?? ""}
                          onValueChange={(val) => setDraftRider(gate, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[200px]">
                            <SelectValue placeholder="Välj förare" />
                          </SelectTrigger>

                          <SelectContent className="text-xs">
                            {(ridersByTeam?.[team] || []).map((opt) => (
                              <SelectItem
                                key={opt.id}
                                value={String(opt.id)}
                                className="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              >
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{r.name}</span>
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
                              <Button
                                variant="deafault"
                                key={pos}
                                type="button"
                                onClick={() =>
                                  setPositionExclusive(r.rider_id, pos)
                                }
                                className={`px-2 py-1 rounded border text-sm transition ${isSelected
                                  ? "bg-blue-600 text-primary"
                                  : "bg-primary text-primary-foreground"
                                  }`}
                                aria-pressed={isSelected}
                              >
                                {pos}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* <div>
                        <label className="text-sm mr-1">Status:</label>
                        <Select
                          value={res.status}
                          onChange={(e) =>
                            updateHeatResult(
                              r.rider_id,
                              "status",
                              e.target.value
                            )
                          }
                          className="text-sm border rounded"
                        >
                          <option value="completed">Genomförd</option>
                          <option value="excluded">Utesluten</option>
                        </Select>
                      </div> */}

                      <div className="">
                        <label className="text-sm">Status:</label>

                        <Select
                          value={res.status} // t.ex. "completed" eller "excluded"
                          onValueChange={(val) =>
                            updateHeatResult(r.rider_id, "status", val)
                          }
                        >
                          <SelectTrigger className="h-8 w-[160px] text-sm">
                            <SelectValue placeholder="Välj status" />
                          </SelectTrigger>

                          <SelectContent className="text-sm">
                            <SelectItem
                              value="completed"
                              className="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                            >
                              Genomförd
                            </SelectItem>
                            <SelectItem
                              value="excluded"
                              className="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                            >
                              Utesluten
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                );
              })}

            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button
                onClick={handleSave}
                disabled={!dialogComplete || nothingChanged}
                title={
                  !dialogComplete
                    ? "Fyll i placering 1–4 (unika) för alla icke-uteslutna förare."
                    : nothingChanged
                      ? "Inga ändringar att spara"
                      : undefined
                }
              >
                Spara resultat
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
