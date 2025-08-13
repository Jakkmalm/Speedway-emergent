// src/components/Scoreboard.jsx
import React from "react";
import { Badge } from "./ui/badge";
import { computeTotalsFromHeats } from "../hooks/useHeats";

export default function Scoreboard({ match }) {
  const { home, away } = computeTotalsFromHeats(match);

  return (
    <div className="grid grid-cols-3 gap-8 text-center">
      <div>
        <div className="text-4xl font-bold text-red-600">{home}</div>
        <div className="text-sm text-gray-600 mb-2">{match.home_team}</div>
        <div className="flex justify-center space-x-1 mb-2">
          <div className="w-4 h-4 bg-red-600 rounded-full"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
        </div>
      </div>
      <div>
        <div className="text-lg text-gray-400">-</div>
        <Badge
          variant={
            match.status === "confirmed"
              ? "default"
              : match.status === "live"
              ? "destructive"
              : "secondary"
          }
        >
          {match.status === "confirmed"
            ? "Bekräftad"
            : match.status === "live"
            ? "Pågår"
            : "Kommande"}
        </Badge>
      </div>
      <div>
        <div className="text-4xl font-bold text-yellow-600">{away}</div>
        <div className="text-sm text-gray-600 mb-2">{match.away_team}</div>
        <div className="flex justify-center space-x-1 mb-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
          <div className="w-4 h-4 bg-white border border-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
