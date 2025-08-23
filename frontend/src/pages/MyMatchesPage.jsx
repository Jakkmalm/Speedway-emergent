// src/pages/MyMatchesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Calendar } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, AlertTriangle } from "lucide-react";
import { getUserMatches, resolveUserMatch, deleteMatch, getMatches } from "../api/matches";
import { useAuth } from "../contexts/AuthContext";
import MatchList from "../components/MatchList";
import UserMatchCard from "@/components/UserMatchCard";
import { toast } from "sonner";
import { deleteUserMatchCascade } from "@/api/matches";
// import { UserMatchCardSkeleton } from "@/components/skeletons/UserMatchCardSkeleton";
// import { MatchListSkeleton } from "@/components/skeletons/MatchListSkeleton";
// import { MatchRowSkeleton } from "@/components/skeletons/MatchRowSkeleton";
import { LoadingBlock } from "@/components/LoadingState";
import { withMinDelay } from "@/lib/withMinDelay";
import { asArray } from "@/lib/asArray";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/PaginationBar";

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
  const [userMatches, setUserMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [resolving, setResolving] = useState({}); // { [userMatchId]: true/false }

  const { user } = useAuth();
  const [matches, setMatches] = useState(null);
  const [deleting, setDeleting] = useState({}); // valfritt per-kort-lås

  const loadUserMatches = async () => {
    try {
      const data = await withMinDelay(getUserMatches(), 350);
      setUserMatches(data);
    } catch (e) {
      console.error("Error loading user matches:", e);
    }
  };

  const loadMatches = async () => {
    try {
      const m = await withMinDelay(getMatches(), 350);
      setMatches(m);
    } catch (e) {
      console.error("Error loading matches:", e);
    }
  };

  // const openMatches = useMemo(() => {
  //   return matches.filter(
  //     (m) => m.created_by === user?.id && (m.status || "").toLowerCase() !== "confirmed"
  //   );
  // }, [matches, user?.id]);


  // NULL-kontroll och filtrering av matcher
  const openMatches = useMemo(
    () =>
      asArray(matches).filter(
        (m) =>
          m?.created_by === user?.id &&
          String(m?.status || "").toLowerCase() !== "confirmed"
      ),
    [matches, user?.id]
  );


  // Sidindelning för protokoll – 5 per sida
  const {
    page: openPage,
    setPage: setOpenPage,
    pageCount: openPageCount,
    pageItems: openPageItems,
  } = usePagination(openMatches, 5);

  // Sidindelning för "Mina matcher" – 5 per sida
  const userMatchesArr = asArray(userMatches);
  const {
    page: umPage,
    setPage: setUmPage,
    pageCount: umPageCount,
    pageItems: umPageItems,
  } = usePagination(userMatchesArr, 5);



  useEffect(() => {
    loadUserMatches();
    loadMatches();
  }, []);

  // const resolve = async (userMatchId, action) => {
  //   setLoadingResolve(true);
  //   try {
  //     await resolveUserMatch(userMatchId, action);
  //     await loadUserMatches();
  //     alert("Konflikt löst!");
  //   } catch (e) {
  //     alert("Kunde inte lösa konflikt: " + e.message);
  //   } finally {
  //     setLoadingResolve(false);
  //   }
  // };
  const resolve = async (userMatchId, action) => {
    // setLoadingResolve(true);
    // try {
    //   await toast.promise(resolveUserMatch(userMatchId, action), {
    //     loading: "Uppdaterar…",
    //     success: "Konflikt uppdaterad",
    //     error: (e) => e?.message || "Kunde inte lösa konflikten",
    //   });
    //   await loadUserMatches();
    // } finally {
    //   setLoadingResolve(false);
    // }
    setResolving(p => ({ ...p, [userMatchId]: true }));
    try {
      await toast.promise(resolveUserMatch(userMatchId, action), {
        loading: "Uppdaterar…",
        success: "Konflikt uppdaterad",
        error: (e) => e?.message || "Kunde inte lösa konflikten",
      });
      await loadUserMatches();
    } finally {
      setResolving(p => ({ ...p, [userMatchId]: false }));
    }
  };

  // const handleDelete = async (id) => {
  //   if (!window.confirm("Ta bort matchen?")) return;
  //   try {
  //     await deleteMatch(id);
  //     setMatches((prev) => prev.filter((m) => m.id !== id));
  //   } catch (e) {
  //     alert("Kunde inte ta bort match: " + e.message);
  //   }
  // };

  // Hantera borttagning av "protokoll""
  const handleDelete = async (id) => {
    await toast.promise(deleteMatch(id), {
      loading: "Tar bort…",
      success: "Protokoll borttaget",
      error: "Kunde inte ta bort matchen",
    });
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };


  // Hantera borttagning av sparade matcher
  const handleDeleteSaved = async (userMatchId, matchId) => {
    setDeleting(p => ({ ...p, [userMatchId]: true }));
    try {
      await toast.promise(deleteUserMatchCascade(userMatchId), {
        loading: "Tar bort…",
        success: "Match borttagen",
        error: (e) => e?.message || "Kunde inte ta bort matchen",
      });

      // Plocka bort korten lokalt
      setUserMatches(prev => prev.filter(um => (um.id || um._id) !== userMatchId));
      setMatches(prev => prev.filter(m => m.id !== matchId)); // ifall du visar protokoll-listan på samma sida
    } finally {
      setDeleting(p => ({ ...p, [userMatchId]: false }));
    }
  };


  return (
    <>
      {/* Mina matcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Mina matcher
          </CardTitle>
          <CardDescription>Matcher du har fyllt i protokoll för</CardDescription>
        </CardHeader>
        {/* <CardContent>
          <div className="space-y-4">
            {userMatches === null ? (
              <div className="space-y-4">
                <LoadingBlock
                  text="Hämtar sparade matcher"
                />

              </div>
            ) : asArray(userMatches).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Du har inte fyllt i några matcher än
              </p>
            ) : (
              <div className="space-y-4">
                {asArray(userMatches).map((um) => (
                  <>
                    <UserMatchCard
                      key={um.id || um._id}
                      userMatch={um}
                      onResolve={resolve}
                      loadingResolve={!!resolving[um.id || um._id]}
                    />
                    <PaginationBar
                      page={openPage}
                      pageCount={openPageCount}
                      onPageChange={setOpenPage}
                    />
                  </>
                ))}
              </div>
            )}
          </div>
        </CardContent> */}
        <CardContent>
          {userMatches === null ? (
            <div className="space-y-4">
              <LoadingBlock text="Hämtar sparade matcher" />
            </div>
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
                    // Om du har borttagning av sparade matcher:
                    onDelete={(userMatchId, matchId) => handleDeleteSaved(userMatchId, matchId)}
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
      {/* Skapade matcher */}
      {/* <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Skapade matcher
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matches === null ? (
            <LoadingBlock
              text="Hämtar protokoll" />
          ) : (

            <>
              <MatchList
                matches={asArray(openMatches)}
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
      </Card> */}
      <Card className="mt-6">
        {/* ...header */}
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Skapade matcher
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matches === null ? (
            <LoadingBlock text="Hämtar protokoll" />
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
