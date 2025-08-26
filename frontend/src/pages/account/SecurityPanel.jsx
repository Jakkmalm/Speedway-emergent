// import React, { useState } from "react";
// import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { useAccount, useChangePassword, useSessions, useRevokeSession, useRevokeAllOtherSessions, useStartEnable2FA, useVerify2FA, useDisable2FA } from "@/queries/account";
// import { toast } from "sonner";

// export default function SecurityPanel() {
//     const { data: account } = useAccount();
//     const changePwd = useChangePassword();

//     // Lösenord
//     const [pwd, setPwd] = useState({ current_password: "", new_password: "" });
//     const onPwd = (k) => (e) => setPwd((p) => ({ ...p, [k]: e.target.value }));
//     const savePwd = async () => {
//         await toast.promise(changePwd.mutateAsync(pwd), {
//             loading: "Byter…",
//             success: "Lösenord uppdaterat",
//             error: (e) => e?.message || "Kunde inte byta lösenord",
//         });
//         setPwd({ current_password: "", new_password: "" });
//     };

//     // 2FA
//     const [setup, setSetup] = useState(null);
//     const enable2fa = useStartEnable2FA();
//     const verify2fa = useVerify2FA();
//     const disable2fa = useDisable2FA();
//     const begin2FA = async () => {
//         const s = await enable2fa.mutateAsync();
//         setSetup(s); // { otpauth_url, secret, qrcodeDataUrl? }
//     };
//     const [code, setCode] = useState("");
//     const confirm2FA = async () => {
//         await toast.promise(verify2fa.mutateAsync(code), {
//             loading: "Aktiverar…",
//             success: "2FA aktiverad",
//             error: "Fel kod",
//         });
//         setSetup(null);
//         setCode("");
//     };
//     const turnOff2FA = async () => {
//         await toast.promise(disable2fa.mutateAsync(), {
//             loading: "Stänger av…",
//             success: "2FA avstängd",
//             error: "Kunde inte stänga av",
//         });
//     };

//     // Sessioner
//     const { data: sessions = [] } = useSessions();
//     const revoke = useRevokeSession();
//     const revokeAllOther = useRevokeAllOtherSessions();

//     return (
//         <div className="grid gap-6">
//             <Card>
//                 <CardHeader><CardTitle>Byt lösenord</CardTitle></CardHeader>
//                 <CardContent className="grid gap-3">
//                     <Input type="password" placeholder="Nuvarande lösenord" value={pwd.current_password} onChange={onPwd("current_password")} />
//                     <Input type="password" placeholder="Nytt lösenord" value={pwd.new_password} onChange={onPwd("new_password")} />
//                     <div className="flex justify-end">
//                         <Button onClick={savePwd} disabled={changePwd.isPending}>Uppdatera</Button>
//                     </div>
//                 </CardContent>
//             </Card>

//             <Card>
//                 <CardHeader><CardTitle>Tvåstegsverifiering</CardTitle></CardHeader>
//                 <CardContent className="grid gap-3">
//                     {account?.two_factor_enabled ? (
//                         <div className="flex items-center justify-between">
//                             <span>2FA är aktivt</span>
//                             <Button variant="outline" onClick={turnOff2FA} disabled={disable2fa.isPending}>Stäng av</Button>
//                         </div>
//                     ) : setup ? (
//                         <div className="grid gap-3">
//                             {setup.qrcodeDataUrl ? (
//                                 <img src={setup.qrcodeDataUrl} alt="Scan QR" className="w-40 h-40" />
//                             ) : (
//                                 <code className="p-2 bg-muted rounded text-xs break-all">{setup.otpauth_url || setup.secret}</code>
//                             )}
//                             <Input placeholder="6-siffrig kod" value={code} onChange={(e) => setCode(e.target.value)} />
//                             <div className="flex justify-end">
//                                 <Button onClick={confirm2FA} disabled={verify2fa.isPending || !code}>Bekräfta</Button>
//                             </div>
//                         </div>
//                     ) : (
//                         <div className="flex justify-between items-center">
//                             <span>Skydda ditt konto med 2FA</span>
//                             <Button onClick={begin2FA} disabled={enable2fa.isPending}>Aktivera</Button>
//                         </div>
//                     )}
//                 </CardContent>
//             </Card>

//             <Card>
//                 <CardHeader><CardTitle>Aktiva sessioner</CardTitle></CardHeader>
//                 <CardContent className="grid gap-3">
//                     {sessions.length === 0 ? (
//                         <div className="text-muted-foreground">Inga sessioner</div>
//                     ) : (
//                         sessions.map((s) => (
//                             <div key={s.id} className="flex items-center justify-between border rounded p-2">
//                                 <div className="text-sm">
//                                     <div>{s.device || "Okänd enhet"} • {s.browser || ""} • {s.os || ""}</div>
//                                     <div className="text-muted-foreground">{s.ip} • Senast: {new Date(s.last_active).toLocaleString("sv-SE")}</div>
//                                 </div>
//                                 <Button variant="outline" size="sm" onClick={() => revoke.mutate(s.id)} disabled={revoke.isPending}>
//                                     Logga ut
//                                 </Button>
//                             </div>
//                         ))
//                     )}
//                     {sessions.length > 1 && (
//                         <div className="flex justify-end">
//                             <Button variant="secondary" size="sm" onClick={() => revokeAllOther.mutate()} disabled={revokeAllOther.isPending}>
//                                 Logga ut från andra enheter
//                             </Button>
//                         </div>
//                     )}
//                 </CardContent>
//             </Card>
//         </div>
//     );
// }

import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    useAccount,
    useChangePassword,
    useSessions,
    useRevokeSession,
    useRevokeAllOtherSessions,
    useStartEnable2FA,
    useVerify2FA,
    useDisable2FA,
} from "@/queries/account";
import { useAuth } from "@/contexts/AuthContext";

/* ---------- Hjälpare för snyggare UA/CH-visning ---------- */

// Plocka bästa token ur sec-ch-ua, ex: `"Google Chrome";v="139", "Chromium";v="139"` -> "Google Chrome 139"
function prettyCH(ch) {
    if (!ch) return "";
    const re = /"([^"]+)";v="(\d+)"/g;
    let m, best = null;
    while ((m = re.exec(ch))) {
        const name = m[1];
        const ver = m[2];
        if (/not.?a.?brand/i.test(name)) continue;
        // “DuckDuckGo”, “Opera”, “Edge”, “Chrome”, “Chromium” – välj det som inte är generiskt om möjligt
        const score =
            /duckduckgo|opera|edge|chrome/i.test(name) ? 2 :
                /chromium/i.test(name) ? 1 : 0;
        if (!best || score > best.score) best = { label: `${name} ${ver}`, score };
    }
    return best ? best.label : ch;
}

// Enkel fallback om sec-ch-ua saknas/är ful
function guessFromUA(ua = "") {
    if (/edg/i.test(ua)) return "Microsoft Edge";
    if (/opr|opera/i.test(ua)) return "Opera";
    if (/duckduckgo/i.test(ua)) return "DuckDuckGo";
    if (/chrome/i.test(ua)) return "Chrome";
    if (/safari/i.test(ua)) return "Safari";
    if (/firefox/i.test(ua)) return "Firefox";
    return "";
}

function prettyBrowser(s) {
    return s.browserNice                  // om backend redan har fixat
        || prettyCH(s.browser)            // sec-ch-ua
        || guessFromUA(s.user_agent)      // user-agent fallback
        || "Okänd browser";
}

function prettyOS(s) {
    // sec-ch-ua-platform returnerar typ "Android" / "Windows" / "iOS"
    if (s.osNice) return s.osNice;
    if (s.os && typeof s.os === "string") return s.os.replace(/"/g, "");
    const ua = s.user_agent || "";
    if (/android/i.test(ua)) return "Android";
    if (/iphone|ipad|ios/i.test(ua)) return "iOS";
    if (/windows/i.test(ua)) return "Windows";
    if (/mac os|macintosh/i.test(ua)) return "macOS";
    if (/linux/i.test(ua)) return "Linux";
    return "Okänt OS";
}

function deviceLabel(s) {
    return s.device || "Okänd enhet";
}

/* --------------------------------------------------------- */

export default function SecurityPanel() {
    const { logout } = useAuth() || {};
    const { data: account } = useAccount();

    // Lösenord
    const changePwd = useChangePassword();
    const [pwd, setPwd] = useState({ current_password: "", new_password: "" });
    const onPwd = (k) => (e) => setPwd((p) => ({ ...p, [k]: e.target.value }));
    const savePwd = async () => {
        await toast.promise(changePwd.mutateAsync(pwd), {
            loading: "Byter…",
            success: "Lösenord uppdaterat",
            error: (e) => e?.message || "Kunde inte byta lösenord",
        });
        setPwd({ current_password: "", new_password: "" });
    };

    // 2FA
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState("");
    const enable2fa = useStartEnable2FA();
    const verify2fa = useVerify2FA();
    const disable2fa = useDisable2FA();

    const begin2FA = async () => {
        const s = await enable2fa.mutateAsync();
        setSetup(s); // { secret, otpauth_url, qrcodeDataUrl? }
    };
    const confirm2FA = async () => {
        await toast.promise(verify2fa.mutateAsync(code), {
            loading: "Aktiverar…",
            success: "2FA aktiverad",
            error: "Fel kod",
        });
        setSetup(null);
        setCode("");
    };
    const turnOff2FA = async () => {
        await toast.promise(disable2fa.mutateAsync(), {
            loading: "Stänger av…",
            success: "2FA avstängd",
            error: "Kunde inte stänga av",
        });
    };

    // Sessioner
    const { data: sessions = [] } = useSessions();
    const revoke = useRevokeSession();                 // DELETE /api/account/sessions/:id
    const revokeAllOther = useRevokeAllOtherSessions(); // DELETE /api/account/sessions {scope:"others"}

    const onRevokeOne = async (s) => {
        await toast.promise(revoke.mutateAsync(s.id), {
            loading: "Loggar ut…",
            success: "Session utloggad",
            error: "Kunde inte logga ut sessionen",
        });
        // Om det var den aktuella sessionen → logga ut klienten direkt
        if (s.current && typeof logout === "function") {
            logout(); // rensa token + navigera till /auth i din AuthContext
        }
    };

    const hasOtherSessions = useMemo(
        () => sessions.some((s) => !s.current),
        [sessions]
    );

    return (
        <div className="grid gap-6">
            {/* Byt lösenord */}
            <Card>
                <CardHeader><CardTitle>Byt lösenord</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                    <Input
                        type="password"
                        placeholder="Nuvarande lösenord"
                        value={pwd.current_password}
                        onChange={onPwd("current_password")}
                    />
                    <Input
                        type="password"
                        placeholder="Nytt lösenord"
                        value={pwd.new_password}
                        onChange={onPwd("new_password")}
                    />
                    <div className="flex justify-end">
                        <Button onClick={savePwd} disabled={changePwd.isPending}>Uppdatera</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tvåstegsverifiering */}
            <Card>
                <CardHeader><CardTitle>Tvåstegsverifiering</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                    {account?.two_factor_enabled ? (
                        <div className="flex items-center justify-between">
                            <span>2FA är aktivt</span>
                            <Button
                                variant="outline"
                                onClick={turnOff2FA}
                                disabled={disable2fa.isPending}
                            >
                                Stäng av
                            </Button>
                        </div>
                    ) : setup ? (
                        <div className="grid gap-3">
                            {setup.qrcodeDataUrl ? (
                                <img src={setup.qrcodeDataUrl} alt="Scan QR" className="w-40 h-40" />
                            ) : (
                                <code className="p-2 bg-muted rounded text-xs break-all">
                                    {setup.otpauth_url || setup.secret}
                                </code>
                            )}
                            <Input
                                placeholder="6-siffrig kod"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button onClick={confirm2FA} disabled={verify2fa.isPending || !code}>
                                    Bekräfta
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center">
                            <span>Skydda ditt konto med 2FA</span>
                            <Button onClick={begin2FA} disabled={enable2fa.isPending}>
                                Aktivera
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Aktiva sessioner */}
            <Card>
                <CardHeader><CardTitle>Aktiva sessioner</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                    {sessions.length === 0 ? (
                        <div className="text-muted-foreground">Inga sessioner</div>
                    ) : (
                        sessions.map((s) => {
                            const browser = prettyBrowser(s);
                            const os = prettyOS(s);
                            const dev = deviceLabel(s);
                            return (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between border rounded p-2"
                                >
                                    <div className="text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{dev}</span>
                                            <span className="text-muted-foreground">• {browser} • {os}</span>
                                            {s.current && (
                                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs">
                                                    Aktiv nu
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-muted-foreground">
                                            {s.ip} • Senast: {new Date(s.last_active).toLocaleString("sv-SE")}
                                        </div>
                                    </div>
                                    <Button
                                        variant={s.current ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={() => onRevokeOne(s)}
                                        disabled={revoke.isPending}
                                        title={s.current ? "Du loggas ut direkt" : "Logga ut denna enhet"}
                                    >
                                        Logga ut
                                    </Button>
                                </div>
                            );
                        })
                    )}

                    {hasOtherSessions && (
                        <div className="flex justify-end">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                    toast.promise(revokeAllOther.mutateAsync(), {
                                        loading: "Loggar ut från andra enheter…",
                                        success: "Utloggad från andra enheter",
                                        error: "Misslyckades logga ut andra enheter",
                                    })
                                }
                                disabled={revokeAllOther.isPending}
                            >
                                Logga ut från andra enheter
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

