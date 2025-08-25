// // src/pages/MyAccountPage.jsx
// import React from "react";
// import { Link } from "react-router-dom";
// import { useTheme } from "next-themes";
// import {
//   Card,
//   CardHeader,
//   CardTitle,
//   CardDescription,
//   CardContent,
// } from "../components/ui/card";
// import { Button } from "../components/ui/button";
// import { User, Bell, Palette } from "lucide-react";

// function AccountCard({ to, title, description, icon }) {
//   return (
//     <Link
//       to={to}
//       className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
//     >
//       <Card className="rounded-2xl bg-card border shadow-sm transition hover:shadow-md hover:border-primary/40 hover:bg-accent/40">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             {icon}
//             {title}
//           </CardTitle>
//           <CardDescription className="text-muted-foreground">
//             {description}
//           </CardDescription>
//         </CardHeader>
//       </Card>
//     </Link>
//   );
// }

// export default function MyAccountPage() {
//   const { theme, setTheme } = useTheme();

//   return (
//     <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
//       {/* Tema / utseende */}
//       <Card className="rounded-2xl bg-card border shadow-sm">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Palette className="w-5 h-5 text-primary" />
//             Tema & Utseende
//           </CardTitle>
//           <CardDescription>Växla mellan ljus/mörk eller följ system.</CardDescription>
//         </CardHeader>
//         <CardContent>
//           <div className="flex gap-2">
//             <Button
//               size="sm"
//               variant={theme === "light" ? "default" : "outline"}
//               onClick={() => setTheme("light")}
//             >
//               Ljus
//             </Button>
//             <Button
//               size="sm"
//               variant={theme === "dark" ? "default" : "outline"}
//               onClick={() => setTheme("dark")}
//             >
//               Mörk
//             </Button>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Kontoinformation */}
//       <AccountCard
//         to="/account/settings"
//         title="Kontoinformation"
//         description="Ändra användarnamn, e-post eller lösenord."
//         icon={<User className="w-5 h-5 text-primary" />}
//       />

//       {/* Notisinställningar */}
//       <AccountCard
//         to="/account/notifications"
//         title="Notisinställningar"
//         description="Hantera push- och e-postnotiser."
//         icon={<Bell className="w-5 h-5 text-primary" />}
//       />
//     </div>
//   );
// }

// MyAccountPage.jsx – struktur med Tabs
// import React from "react";
// import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import { Badge } from "@/components/ui/badge";
// import ProfilePanel from "./account/ProfilePanel";
// import AppearancePanel from "./account/AppearancePanel";
// import NotificationsPanel from "./account/NotificationsPanel";
// import SecurityPanel from "./account/SecurityPanel";
// import DataPrivacyPanel from "./account/DataPrivacyPanel";

// export default function MyAccountPage() {
//   return (
//     <div className="max-w-5xl mx-auto space-y-6">
//       {/* Headerkort */}
//       <Card className="rounded-2xl">
//         <CardContent className="p-6 flex items-center justify-between">
//           <div className="flex items-center gap-4">
//             <Avatar className="h-14 w-14">
//               <AvatarImage src="/me.jpg" alt="Avatar" />
//               <AvatarFallback>CB</AvatarFallback>
//             </Avatar>
//             <div>
//               <div className="text-xl font-semibold">Ditt namn</div>
//               <div className="text-sm text-muted-foreground">@anvandarnamn</div>
//             </div>
//           </div>
//           <div className="flex gap-2">
//             <Badge variant="secondary">12 protokoll</Badge>
//             <Badge variant="secondary">Senast aktiv: 3 aug</Badge>
//             <Badge variant="secondary">Elitserien</Badge>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Navigering + paneler */}
//       <Tabs defaultValue="profile" className="space-y-4">
//         <TabsList className="grid grid-cols-5 md:w-auto">
//           <TabsTrigger value="profile">Profil</TabsTrigger>
//           <TabsTrigger value="appearance">Utseende</TabsTrigger>
//           <TabsTrigger value="notifications">Notiser</TabsTrigger>
//           <TabsTrigger value="security">Säkerhet</TabsTrigger>
//           <TabsTrigger value="privacy">Data & sekretess</TabsTrigger>
//         </TabsList>

//         <TabsContent value="profile"><ProfilePanel /></TabsContent>
//         <TabsContent value="appearance"><AppearancePanel /></TabsContent>
//         <TabsContent value="notifications"><NotificationsPanel /></TabsContent>
//         <TabsContent value="security"><SecurityPanel /></TabsContent>
//         <TabsContent value="privacy"><DataPrivacyPanel /></TabsContent>
//       </Tabs>
//     </div>
//   );
// }

