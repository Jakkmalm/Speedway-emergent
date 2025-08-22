// src/components/UserMatchCard.jsx
import React, { useState, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, AlertTriangle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(dateString) {
    if (!dateString) return "";
    try {
        return new Date(dateString).toLocaleString("sv-SE", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return dateString;
    }
}

function statusBadgeVariant(status) {
    if (status === "validated") return "default";
    if (status === "disputed") return "destructive";
    return "secondary";
}

// Minimal “poängrad” för heat (t.ex. "3,2,1,0" eller "-")
function heatPointsLine(heat) {
    const arr = (heat?.results || []).map((r) =>
        (typeof r?.points === "number" ? r.points : null)
    );
    if (!arr.length) return "–";
    return arr.join(", ");
}

export default function UserMatchCard({
    userMatch,
    onResolve,     // (userMatchId, action) => Promise
    loadingResolve // boolean
}) {
    const [open, setOpen] = useState(false);

    const {
        id,
        status,
        discrepancies = [],
        user_results,
        official_results,
        match_details,
    } = userMatch || {};

    const title = useMemo(() => {
        const home = match_details?.home_team || "Hemmalag";
        const away = match_details?.away_team || "Bortalag";
        return `${home} vs ${away}`;
    }, [match_details]);

    const score = useMemo(() => {
        const h = user_results?.home_score ?? 0;
        const a = user_results?.away_score ?? 0;
        return `${h} - ${a}`;
    }, [user_results]);

    const dateStr = formatDate(match_details?.date);

    const toggle = useCallback(() => setOpen((o) => !o), []);

    return (
        <Card className="border hover:shadow-md transition">
            <button
                type="button"
                onClick={toggle}
                className="w-full text-left"
                aria-expanded={open}
            >
                <CardHeader className="flex flex-row items-center gap-3">
                    <div className="shrink-0">
                        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </div>

                    <div className="flex-1">
                        <CardTitle className="flex items-center gap-3">
                            <span>{title}</span>
                            <Badge variant={statusBadgeVariant(status)}>
                                {status === "validated" ? "Validerad" :
                                    status === "disputed" ? "Konflikt" : "Komplett"}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2">
                            <span className="font-medium">{score}</span>
                            <span className="text-muted-foreground">•</span>
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span>{dateStr}</span>
                        </CardDescription>
                    </div>
                </CardHeader>
            </button>

            {/* Discrepancy-banner (klick på knapparna ska INTE toggla kortet) */}
            {discrepancies.length > 0 && (
                <CardContent
                    onClick={(e) => e.stopPropagation()}
                    className="pt-0"
                >
                    <div className="mt-2 rounded-md border bg-yellow-50 p-3 dark:bg-yellow-950/20 dark:border-yellow-900">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
                            <span className="font-medium text-yellow-800 dark:text-yellow-300">
                                Avvikelser upptäckta
                            </span>
                        </div>
                        <div className="space-y-1 text-sm">
                            {discrepancies.map((disc, i) => (
                                <div key={`${disc.type}-${i}`} className="flex justify-between">
                                    <span>{disc.type === "home_score" ? "Hemmalag poäng" : "Bortalag poäng"}:</span>
                                    <span>
                                        Du: {disc.user_value} | Officiellt: {disc.official_value}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <Button
                                size="sm"
                                onClick={() => onResolve?.(id, "accept_official")}
                                disabled={loadingResolve}
                            >
                                Acceptera officiellt
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onResolve?.(id, "keep_user")}
                                disabled={loadingResolve}
                            >
                                Behåll mitt
                            </Button>
                        </div>
                    </div>
                </CardContent>
            )}

            {/* Officiellt resultat (om finns, och inga avvikelser) */}
            {official_results && discrepancies.length === 0 && (
                <CardContent onClick={(e) => e.stopPropagation()} className="pt-0">
                    <p className="text-sm text-muted-foreground">
                        Officiellt resultat:{" "}
                        <span className="font-medium">
                            {official_results.home_score} - {official_results.away_score}
                        </span>{" "}
                        (källa: {official_results.source || "okänd"})
                    </p>
                </CardContent>
            )}

            {/* HEAT-ÖVERSIKT (visas vid expand) */}
            {open && (
                <CardContent className="border-t mt-2 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {(user_results?.heats || []).map((h) => (
                            <Card key={h.heat_number} className={cn(
                                "p-3",
                                h.status === "completed" ? "bg-card" : "bg-muted"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">Heat {h.heat_number}</div>
                                    <Badge variant={h.status === "completed" ? "secondary" : "outline"}>
                                        {h.status === "completed" ? "Klar" : "Öppen"}
                                    </Badge>
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Poäng: {heatPointsLine(h)}
                                </div>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
