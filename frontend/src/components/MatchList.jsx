// src/components/MatchList.jsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Play, Calendar, TrashIcon, Trash2Icon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ConfirmButton } from "./ConfirmButton";


function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchList({ matches, userId, onDelete }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const myMatches = matches.filter((m) => userId && m.created_by === userId);

  return (
    <div className="space-y-4">
      {myMatches.map((match) => (
        <div
          key={match.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted"
        >
          <div className="flex-1">
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
            <div className="flex items-center space-x-4">
              <div className="text-lg font-semibold">
                {match.home_team} vs {match.away_team}
              </div>

            </div>
            <div className="text-sm text-gray-600 mt-1">
              {formatDate(match.date)} {match.venue ? `• ${match.venue}` : ""}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2 w-auto">
            {/* Play/Resume button */}
            <Button
              onClick={() => navigate(`/match/${match.id}`)}
              size="sm"
              className="sm:flex-none"
            >
              <Play className="w-4 h-4 mr-0 sm:mr-2" />
              {/* Text göms på små skärmar, visas på sm+ */}
              <span className="hidden sm:inline">
                {match.heats.some((h) => h.results?.length > 0)
                  ? "Återuppta protokoll"
                  : "Starta protokoll"}
              </span>
            </Button>

            {/* Delete button */}
            <ConfirmButton
              title="Ta bort match?"
              description="Detta går inte att ångra. Protokollet kommer att raderas."
              confirmText="Ta bort"
              onConfirm={() => onDelete(match.id)}
            >
              <span className="hidden sm:inline">Ta bort</span>
              <span className="sm:hidden"><Trash2Icon /></span>
            </ConfirmButton>
          </div>

          {/* <div className="flex items-center gap-2">
            <Button onClick={() => navigate(`/match/${match.id}`)} size="sm">

              <Play className="w-4 h-4 mr-2" />
              {match.heats.some((h) => h.results?.length > 0)
                ? "Återuppta protokoll"
                : "Starta protokoll"}
            </Button>

            <Button
              onClick={() => onDelete(match.id)}
              size="sm"
              variant="destructive"
            >
              Ta bort
            </Button>
          </div> */}
        </div>
      ))}
      {myMatches.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          Inga skapade matcher ännu
        </p>
      )}
    </div>
  );
}
