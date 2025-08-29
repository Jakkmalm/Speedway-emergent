// // src/pages/account/AccountPage.jsx
// import React from "react";
// import { Card, CardContent } from "@/components/ui/card";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import { Badge } from "@/components/ui/badge";
// import { useAccount } from "@/queries/account";
// import ProfilePanel from "./ProfilePanel";
// import AppearancePanel from "./AppearancePanel";
// import NotificationsPanel from "./NotificationsPanel";
// import SecurityPanel from "./SecurityPanel";
// import DataPrivacyPanel from "./DataPrivacyPanel";

// export default function AccountPage() {
//     const { data: account } = useAccount();

//     return (
//         <div className="max-w-5xl mx-auto space-y-6">
//             <Card className="rounded-2xl">
//                 <CardContent className="p-6 flex items-center justify-between">
//                     <div className="flex items-center gap-4">
//                         <Avatar className="h-14 w-14">
//                             <AvatarImage src={account?.avatar_url} alt={account?.display_name || "User"} />
//                             <AvatarFallback>{(account?.display_name || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
//                         </Avatar>
//                         <div>
//                             <div className="text-xl font-semibold">{account?.display_name || "Mitt konto"}</div>
//                             <div className="text-sm text-muted-foreground">@{account?.username || "anvandare"}</div>
//                         </div>
//                     </div>
//                     <div className="flex gap-2">
//                         {account?.stats?.protocols != null && (
//                             <Badge variant="secondary">{account.stats.protocols} protokoll</Badge>
//                         )}
//                         {account?.stats?.last_active && (
//                             <Badge variant="secondary">Senast: {new Date(account.stats.last_active).toLocaleDateString("sv-SE")}</Badge>
//                         )}
//                     </div>
//                 </CardContent>
//             </Card>

//             <Tabs defaultValue="profile" className="space-y-4">
//                 <TabsList className="grid grid-cols-5 md:w-auto">
//                     <TabsTrigger value="profile">Profil</TabsTrigger>
//                     <TabsTrigger value="appearance">Utseende</TabsTrigger>
//                     <TabsTrigger value="notifications">Notiser</TabsTrigger>
//                     <TabsTrigger value="security">Säkerhet</TabsTrigger>
//                     <TabsTrigger value="privacy">Data & sekretess</TabsTrigger>
//                 </TabsList>

//                 <TabsContent value="profile"><ProfilePanel /></TabsContent>
//                 <TabsContent value="appearance"><AppearancePanel /></TabsContent>
//                 <TabsContent value="notifications"><NotificationsPanel /></TabsContent>
//                 <TabsContent value="security"><SecurityPanel /></TabsContent>
//                 <TabsContent value="privacy"><DataPrivacyPanel /></TabsContent>
//             </Tabs>
//         </div>
//     );
// }

import { Link, Outlet, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/queries/account";

export default function AccountPage() {
    const { data: account } = useAccount();
    const { pathname } = useLocation();

    const navItems = [
        { to: "", label: "Profil" },         // "/account" → profil
        { to: "appearance", label: "Utseende" },
        { to: "notifications", label: "Notiser" },
        { to: "security", label: "Säkerhet" },
        { to: "privacy", label: "Data & sekretess" },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* toppkortet med avatar och statistik */}
            <Card className="rounded-2xl">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14">
                            <AvatarImage src={account?.avatar_url} alt={account?.display_name || "User"} />
                            <AvatarFallback>{(account?.display_name || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="text-xl font-semibold">{account?.display_name || "Mitt konto"}</div>
                            <div className="text-sm text-muted-foreground">@{account?.username || "anvandare"}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {account?.stats?.protocols != null && (
                            <Badge variant="secondary">{account.stats.protocols} protokoll</Badge>
                        )}
                        {account?.stats?.last_active && (
                            <Badge variant="secondary">
                                Senast: {new Date(account.stats.last_active).toLocaleDateString("sv-SE")}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* navigering */}
            <nav className="hidden md:flex flex-wrap gap-3">
                {navItems.map(({ to, label }) => (
                    <Link
                        key={to}
                        to={to}
                        className={`px-3 py-1 rounded ${(pathname === "/account" && to === "") || pathname.endsWith("/" + to)
                            ? "bg-primary text-primary-foreground"
                            : "text-primary hover:underline"
                            }`}
                    >
                        {label}
                    </Link>
                ))}
            </nav>

            {/* Outlet för undersidor */}
            <Outlet />
        </div>
    );
}

