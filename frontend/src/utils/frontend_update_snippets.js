// src/utils/frontend_update_snippets.js
export function computeHeatBonuses(heat) {
  const bonuses = {};
  if (!heat || !Array.isArray(heat.results)) return bonuses;
  const finished = heat.results
    .filter((r) => r.status === "completed" && typeof r.position === "number")
    .sort((a, b) => a.position - b.position);
  if (finished.length < 3) return bonuses;
  // mappa rider_id → lag
  const riderTeams = {};
  Object.values(heat.riders).forEach((rider) => {
    riderTeams[rider.rider_id] = rider.team;
  });
  // bonus till andraplacerad lagkamrat i 5‑1
  if (riderTeams[finished[0].rider_id] === riderTeams[finished[1].rider_id]) {
    bonuses[finished[1].rider_id] = 1;
  }
  // bonus till tredjeplacerad lagkamrat i 3‑3
  if (riderTeams[finished[1].rider_id] === riderTeams[finished[2].rider_id]) {
    bonuses[finished[2].rider_id] = 1;
  }
  return bonuses;
}
