// === Example React component: HeatRow ===
// This component renders a single heat with four riders, editable positions,
// and a place to input results.  It assumes props:
//   - heat: the heat object from the backend (with riders and results)
//   - ridersByTeam: {home: [rider objects], away: [rider objects]} for
//     building dropdowns when changing riders
//   - onSubmitResult: callback to submit the results (calls backend)
//   - onChangeRider: callback when a rider is changed (calls updateHeatRiders)
//   - showBonuses: boolean, whether to display bonus points next to rider points
// This is only a conceptual example; integrate with your existing table/list.
import React, { useState } from "react";
import { updateHeatRiders } from "../utils/matchHelpers";
import { computeHeatBonuses } from "../utils/frontend_update_snippets";





export function HeatRow({
  heat,
  ridersByTeam,
  onSubmitResult,
  onChangeRider,
  showBonuses,
}) {
  const [localResults, setLocalResults] = useState(heat.results || []);
  const bonuses = computeHeatBonuses({ ...heat, results: localResults });

  // Helper to build a rider select dropdown for a gate
  function RiderSelect({ gate, riderInfo }) {
    const team = riderInfo.team; // "home" or "away"
    const options = ridersByTeam[team] || [];
    const handleChange = (e) => {
      const newId = e.target.value;
      onChangeRider(heat.heat_number, { [gate]: newId });
    };
    return (
      <select
        value={riderInfo.rider_id}
        onChange={handleChange}
        disabled={heat.heat_number < 5 || heat.heat_number > 13}
      >
        {options.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    );
  }

  // Handle result input change (position or status)
  function handleResultChange(riderId, field, value) {
    setLocalResults((prev) => {
      const updated = prev.map((r) =>
        r.rider_id === riderId ? { ...r, [field]: value } : r
      );
      return updated;
    });
  }

  return (
    <tr>
      <td>Heat {heat.heat_number}</td>
      {Object.entries(heat.riders).map(([gate, rider]) => (
        <td key={gate}>
          {/* Dropdown to change rider when tactical reserves allowed */}
          <RiderSelect gate={gate} riderInfo={rider} />
        </td>
      ))}
      {Object.entries(heat.riders).map(([gate, rider]) => {
        const res =
          localResults.find((r) => r.rider_id === rider.rider_id) || {};
        const bonus = bonuses[rider.rider_id] || 0;
        return (
          <td key={`result-${gate}`}>
            {/* Position input */}
            <input
              type="number"
              min="1"
              max="4"
              value={res.position || ""}
              onChange={(e) =>
                handleResultChange(
                  rider.rider_id,
                  "position",
                  Number(e.target.value)
                )
              }
            />
            {/* Status select (completed/excluded) */}
            <select
              value={res.status || "completed"}
              onChange={(e) =>
                handleResultChange(rider.rider_id, "status", e.target.value)
              }
            >
              <option value="completed">Klar</option>
              <option value="excluded">Utesluten</option>
            </select>
            {/* Display points with optional bonus */}
            {res.status === "completed" && res.position && (
              <span>
                {` → ${3 - (res.position - 1)}${bonus ? `+${bonus}` : ""} p`}
              </span>
            )}
          </td>
        );
      })}
      <td>
        {/* Button to submit the heat result to backend */}
        <button onClick={() => onSubmitResult(heat.heat_number, localResults)}>
          Spara resultat
        </button>
      </td>
    </tr>
  );
}

// === Integration tips ===
// 1. When creating a match via POST /api/matches, the backend now returns 15 heats
//    with riders prefilled according to the predetermined schedule.  Store this
//    array in your state (e.g. match.heats) and render each using HeatRow.
// 2. Maintain a dictionary of riders per team in your state, fetched via
//    GET /api/teams/{id}/riders.  Pass this to HeatRow as `ridersByTeam` so
//    the dropdown options show only the appropriate team members.
// 3. Remove all state and UI elements related to jokers (e.g. jokerRider,
//    jokerTeam, canUseJoker) and their associated handlers.
// 4. To handle tactical reserves, call `updateHeatRiders` in your
//    onChangeRider callback.  Ensure the match view refreshes the heat data
//    after a successful update.
// 5. Use `computeHeatBonuses` (already provided) to calculate bonus points
//    whenever heat results change.  Display these next to each rider's points
//    using the pattern shown above.
// 6. Consider adding visual cues (color or icon) to indicate bonus points so
//    users can quickly see when a bonus has been awarded.
