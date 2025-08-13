// src/hooks/useHeats.js

export const isValidPosition = (n) => Number.isInteger(n) && n >= 1 && n <= 4;

export const isHeatCompleteFromForm = (heat, formResults) => {
  if (!heat) return false;
  const used = new Set();
  for (const gate of Object.keys(heat.riders).sort()) {
    const rider = heat.riders[gate];
    const res = formResults?.[rider.rider_id];
    const status = res?.status || "completed";
    const pos = res?.position === "" ? "" : Number(res?.position);
    if (status !== "completed" && status !== "excluded") return false;
    if (status === "completed") {
      if (!isValidPosition(pos)) return false;
      if (used.has(pos)) return false;
      used.add(pos);
    }
  }
  return true;
};

export const isHeatSavedComplete = (heat) => {
  if (!heat || !Array.isArray(heat.results) || heat.results.length === 0) {
    return false;
  }
  const used = new Set();
  for (const gate of Object.keys(heat.riders).sort()) {
    const riderId = heat.riders[gate].rider_id;
    const res = heat.results.find((r) => String(r.rider_id) === String(riderId));
    if (!res) return false;
    if (res.status === "completed") {
      if (!isValidPosition(res.position)) return false;
      if (used.has(res.position)) return false;
      used.add(res.position);
    } else if (res.status === "excluded") {
      // ok
    } else {
      return false;
    }
  }
  return true;
};

export const computeTotalsFromHeats = (match) => {
  let home = 0, away = 0;
  if (!match?.heats) return { home, away };
  for (const h of match.heats) {
    if (!Array.isArray(h.results)) continue;
    for (const res of h.results) {
      const pts = Number(res.points) || 0;
      const riderEntry = Object.values(h.riders || {}).find(
        (g) => String(g?.rider_id) === String(res.rider_id)
      );
      const team = riderEntry?.team;
      if (team === "home") home += pts;
      else if (team === "away") away += pts;
    }
  }
  return { home, away };
};

export function computeHeatBonuses(heat) {
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

export const helmetColorFor = (team, gate) => {
  if (team === "home") {
    return gate === "1" || gate === "3" ? "#DC2626" : "#2563EB"; // röd / blå
  } else {
    return gate === "2" || gate === "4" ? "#EAB308" : "#FFFFFF"; // gul / vit
  }
};

export const getRiderGateStyle = (team, gate) => {
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

export const getPositionColor = (position) => {
  switch (position) {
    case 1: return "bg-yellow-500 text-black";
    case 2: return "bg-gray-400 text-white";
    case 3: return "bg-amber-600 text-white";
    case 4: return "bg-gray-600 text-white";
    default: return "bg-gray-200 text-gray-700";
  }
};
