// src/pages/MyMatchesPage.jsx
import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import MatchList from "@/components/MatchList";
import UserMatchCard from "@/components/UserMatchCard";
import { toast } from "sonner";
import { LoadingBlock } from "@/components/LoadingState";
import { asArray } from "@/lib/asArray";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/PaginationBar";

// ✅ TanStack hooks
import {
  useMatches,
  useUserMatches,
  useResolveUserMatch,
  useDeleteMatch,
  useDeleteUserMatchCascade,
} from "@/queries/matches";

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyMatchesPage() {
  const { user } = useAuth();

  // Läs listorna via Query – cache för back-navigering; uppdatera via invalidation
  const {
    data: matches = [],
    isLoading: loadingMatches,
    error: matchesError,
  } = useMatches({ staleTime: Infinity });

  const {
    data: userMatches = [],
    isLoading: loadingUserMatches,
    error: userMatchesError,
  } = useUserMatches({ staleTime: Infinity });

  // Mutationer
  const resolveMutation = useResolveUserMatch();
  const deleteMatchMutation = useDeleteMatch();
  const deleteUserMatchCascadeMutation = useDeleteUserMatchCascade();

  // Filtrera “öppna” protokoll du skapat
  const openMatches = useMemo(
    () =>
      asArray(matches).filter(
        (m) =>
          m?.created_by === user?.id &&
          String(m?.status || "").toLowerCase() !== "confirmed"
      ),
    [matches, user?.id]
  );

  // Sidindelning
  const {
    page: openPage,
    setPage: setOpenPage,
    pageCount: openPageCount,
    pageItems: openPageItems,
  } = usePagination(openMatches, 5);

  const userMatchesArr = asArray(userMatches);
  const {
    page: umPage,
    setPage: setUmPage,
    pageCount: umPageCount,
    pageItems: umPageItems,
  } = usePagination(userMatchesArr, 5);

  // UI-state för knapplås
  const [resolving, setResolving] = useState({});
  const [deleting, setDeleting] = useState({});

  // Handlers

  const resolve = async (userMatchId, action) => {
    setResolving((p) => ({ ...p, [userMatchId]: true }));
    try {
      await toast.promise(resolveMutation.mutateAsync({ userMatchId, action }), {
        loading: "Uppdaterar…",
        success: "Konflikt uppdaterad",
        error: (e) => e?.message || "Kunde inte lösa konflikten",
      });
      // Hooken invaliderar userMatches → hämtar om vid behov (annars cache)
    } finally {
      setResolving((p) => ({ ...p, [userMatchId]: false }));
    }
  };

  const handleDelete = async (id) => {
    await toast.promise(deleteMatchMutation.mutateAsync(id), {
      loading: "Tar bort…",
      success: "Protokoll borttaget",
      error: "Kunde inte ta bort matchen",
    });
    // Hooken invaliderar matches (+ ev. userMatches om du vill utöka det i hooken)
  };

  const handleDeleteSaved = async (userMatchId /*, matchId */) => {
    setDeleting((p) => ({ ...p, [userMatchId]: true }));
    try {
      await toast.promise(deleteUserMatchCascadeMutation.mutateAsync(userMatchId), {
        loading: "Tar bort…",
        success: "Match borttagen",
        error: (e) => e?.message || "Kunde inte ta bort matchen",
      });
      // Hooken invaliderar både userMatches och matches
    } finally {
      setDeleting((p) => ({ ...p, [userMatchId]: false }));
    }
  };

  return (
    <>
      {/* Mina matcher (sparade protokoll) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Mina matcher
          </CardTitle>
          <CardDescription>Matcher du har fyllt i protokoll för</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUserMatches ? (
            <div className="space-y-4">
              <LoadingBlock text="Hämtar sparade matcher" />
            </div>
          ) : userMatchesError ? (
            <p className="text-red-600">Kunde inte ladda dina matcher</p>
          ) : userMatchesArr.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Du har inte fyllt i några matcher än
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {umPageItems.map((um) => (
                  <UserMatchCard
                    key={um.id || um._id}
                    userMatch={um}
                    onResolve={resolve}
                    loadingResolve={!!resolving[um.id || um._id]}
                    onDelete={(userMatchId) => handleDeleteSaved(userMatchId)}
                  />
                ))}
              </div>

              <PaginationBar
                page={umPage}
                pageCount={umPageCount}
                onPageChange={setUmPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Skapade matcher (öppna protokoll) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Skapade matcher
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMatches ? (
            <LoadingBlock text="Hämtar protokoll" />
          ) : matchesError ? (
            <p className="text-red-600">Kunde inte ladda skapade matcher</p>
          ) : (
            <>
              <MatchList
                matches={openPageItems}
                userId={user?.id}
                onDelete={handleDelete}
              />
              <PaginationBar
                page={openPage}
                pageCount={openPageCount}
                onPageChange={setOpenPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

