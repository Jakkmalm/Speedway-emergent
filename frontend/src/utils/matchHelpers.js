// src/utils/matchHelpers.js
export async function updateHeatRiders(matchId, heatNumber, assignments, token) {
  const response = await fetch(
    `/api/matches/${matchId}/heat/${heatNumber}/riders`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(assignments),
    }
  );
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || "Kunde inte uppdatera heat‑uppställningen");
  }
  return await response.json();
}
