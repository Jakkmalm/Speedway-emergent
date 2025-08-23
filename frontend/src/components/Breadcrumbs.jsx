import React, { useMemo } from "react";
import { Link, useLocation, matchPath } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb";

// 1) Definiera din breadcrumb-hierarki (utan "Start/Home")
/**
 * label: string | (params, location) => string
 * parent: path till förälder
 */
const ROUTE_CRUMBS = {
    "/dashboard": {
        label: "Dashboard",
    },
    "/matches": {
        // Om du kommer från Dashboard-kortet kan du döpa om "Matcher" till "Skapa match"
        label: (_params, location) => location.state?.breadcrumbLabel || "Matcher",
        parent: "/dashboard",
    },
    "/match/:id": {
        label: "Protokoll",
        parent: "/matches",
    },
    "/my-matches": {
        label: "Mina protokoll",
        parent: "/dashboard",
    },
    "/account": {
        label: "Mina sidor",
        parent: "/Mina sidor",
    },
    "/account/settings": {
        label: "Inställningar",
        parent: "/account",
    },
    "/account/notifications": {
        label: "Notiser",
        parent: "/account",
    },
};

function resolveMatch(pathname) {
    // hitta den route-definition som matchar nuvarande path
    for (const pattern of Object.keys(ROUTE_CRUMBS)) {
        const m = matchPath({ path: pattern, end: true }, pathname);
        if (m) return { pattern, params: m.params };
    }
    return null;
}

export default function Breadcrumbs({ hideIfNoMatch = true }) {
    const location = useLocation();

    const items = useMemo(() => {
        const match = resolveMatch(location.pathname);
        if (!match) return [];

        const chain = [];
        let cursor = match.pattern;

        // 2) Bygg kedjan från aktuell route upp till roten (Dashboard)
        while (cursor) {
            const def = ROUTE_CRUMBS[cursor];
            if (!def) break;

            const label =
                typeof def.label === "function"
                    ? def.label(match.params, location)
                    : def.label;

            // href: använd faktisk URL för den nedersta nivån,
            // och definierade path för föräldrar (de är statiska i vår karta)
            const href = cursor === match.pattern ? location.pathname : cursor;

            chain.unshift({ label, href, isCurrent: cursor === match.pattern });
            cursor = def.parent;
        }

        return chain;
    }, [location]);

    if (hideIfNoMatch && items.length === 0) return null;

    return (
        <Breadcrumb className="p-4">
            <BreadcrumbList>
                {items.map((it, i) => {
                    const isLast = i === items.length - 1;
                    return (
                        <React.Fragment key={it.href}>
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{it.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link to={it.href}>{it.label}</Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator />}
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
