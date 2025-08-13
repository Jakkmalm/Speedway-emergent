// src/components/TeamTable.jsx
import React from "react";
import { Badge } from "./ui/badge";
import { Trophy } from "lucide-react";

export default function TeamTable({ teams }) {
  return (
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
              <td className="py-3 px-4 text-gray-600">{team.city}</td>
              <td className="py-3 px-4 text-right">{team.matches_played}</td>
              <td className="py-3 px-4 text-right">
                <Badge variant={index < 3 ? "default" : "secondary"}>
                  {team.points}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
