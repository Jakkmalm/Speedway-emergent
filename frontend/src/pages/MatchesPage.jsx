// src/pages/MatchesPage.jsx
import React, { useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ✅ TanStack hooks
import {
  useMatches,
  useOfficialMatches,
  useCreateFromOfficial,
  useMatch, // om du vill förladda en specifik match senare
} from "@/queries/matches";

export default function MatchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Läs listor via Query – ingen onödig refetch på back-navigering
  const { data: matches = [] } = useMatches({ staleTime: Infinity });
  const {
    data: official = [],
    isLoading: loadingOfficial,
    error: officialError,
  } = useOfficialMatches({
    enabled: !!user,                     // hämta bara om inloggad
    staleTime: 15 * 60 * 1000,           // 15 min cache är rimligt för schema
    select: (xs) => [...xs].sort((a, b) => new Date(a.date) - new Date(b.date)), // sortera i cachen
  });

  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const selectedOfficial = useMemo(
    () => official.find((x) => x.id === selectedOfficialId) || null,
    [official, selectedOfficialId]
  );

  // Mutation
  const createFromOfficial = useCreateFromOfficial();

  const onSelectOfficial = async (officialId) => {
    setSelectedOfficialId(officialId);
    const m = official.find((x) => x.id === officialId);
    if (!m) return;

    try {
      // Skapa eller återanvänd protokoll
      const res = await createFromOfficial.mutateAsync(m.id);
      if (res?.match_id) {
        navigate(`/match/${res.match_id}`);
        return;
      }
      toast("Kunde inte skapa matchen");
    } catch (e) {
      if (e?.status === 409) {
        toast("Du har redan färdigställt denna match", {
          description: "Öppna Mina matcher för att se resultatet.",
          action: { label: "Mina matcher", onClick: () => navigate("/my-matches") },
          duration: 6000,
        });
        return;
      }
      toast.error(e?.message || "Något gick fel");
    }
  };

  return (
    <div className="grid gap-6">
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Välj officiell match</CardTitle>
            <CardDescription>Välj från listan för att skapa din match</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label>Officiella matcher</Label>
              <Select
                value={selectedOfficialId ?? undefined}
                onValueChange={onSelectOfficial}
                disabled={loadingOfficial || !!officialError}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingOfficial
                        ? "Laddar…"
                        : official.length
                          ? "Välj match…"
                          : "Inga officiella matcher"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {official.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.home_team} vs {m.away_team} •{" "}
                      {new Date(m.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {new Date(m.date).toLocaleDateString("sv-SE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedOfficial && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Vald: <strong>{selectedOfficial.home_team}</strong> vs{" "}
                  <strong>{selectedOfficial.away_team}</strong> •{" "}
                  {new Date(selectedOfficial.date).toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* (Valfritt) Visa egna skapade matcher på sidan – matches kommer från cachen */}
      {/* <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Skapade matcher
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded">{JSON.stringify(matches, null, 2)}</pre>
        </CardContent>
      </Card> */}
    </div>
  );
}

