import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccount, useChangePassword, useSessions, useRevokeSession, useRevokeAllOtherSessions, useStartEnable2FA, useVerify2FA, useDisable2FA } from "@/queries/account";
import { toast } from "sonner";

export default function SecurityPanel() {
    const { data: account } = useAccount();
    const changePwd = useChangePassword();

    // Lösenord
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
    const enable2fa = useStartEnable2FA();
    const verify2fa = useVerify2FA();
    const disable2fa = useDisable2FA();
    const begin2FA = async () => {
        const s = await enable2fa.mutateAsync();
        setSetup(s); // { otpauth_url, secret, qrcodeDataUrl? }
    };
    const [code, setCode] = useState("");
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
    const revoke = useRevokeSession();
    const revokeAllOther = useRevokeAllOtherSessions();

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader><CardTitle>Byt lösenord</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                    <Input type="password" placeholder="Nuvarande lösenord" value={pwd.current_password} onChange={onPwd("current_password")} />
                    <Input type="password" placeholder="Nytt lösenord" value={pwd.new_password} onChange={onPwd("new_password")} />
                    <div className="flex justify-end">
                        <Button onClick={savePwd} disabled={changePwd.isPending}>Uppdatera</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Tvåstegsverifiering</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                    {account?.two_factor_enabled ? (
                        <div className="flex items-center justify-between">
                            <span>2FA är aktivt</span>
                            <Button variant="outline" onClick={turnOff2FA} disabled={disable2fa.isPending}>Stäng av</Button>
                        </div>
                    ) : setup ? (
                        <div className="grid gap-3">
                            {setup.qrcodeDataUrl ? (
                                <img src={setup.qrcodeDataUrl} alt="Scan QR" className="w-40 h-40" />
                            ) : (
                                <code className="p-2 bg-muted rounded text-xs break-all">{setup.otpauth_url || setup.secret}</code>
                            )}
                            <Input placeholder="6-siffrig kod" value={code} onChange={(e) => setCode(e.target.value)} />
                            <div className="flex justify-end">
                                <Button onClick={confirm2FA} disabled={verify2fa.isPending || !code}>Bekräfta</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center">
                            <span>Skydda ditt konto med 2FA</span>
                            <Button onClick={begin2FA} disabled={enable2fa.isPending}>Aktivera</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Aktiva sessioner</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                    {sessions.length === 0 ? (
                        <div className="text-muted-foreground">Inga sessioner</div>
                    ) : (
                        sessions.map((s) => (
                            <div key={s.id} className="flex items-center justify-between border rounded p-2">
                                <div className="text-sm">
                                    <div>{s.device || "Okänd enhet"} • {s.browser || ""} • {s.os || ""}</div>
                                    <div className="text-muted-foreground">{s.ip} • Senast: {new Date(s.last_active).toLocaleString("sv-SE")}</div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => revoke.mutate(s.id)} disabled={revoke.isPending}>
                                    Logga ut
                                </Button>
                            </div>
                        ))
                    )}
                    {sessions.length > 1 && (
                        <div className="flex justify-end">
                            <Button variant="secondary" size="sm" onClick={() => revokeAllOther.mutate()} disabled={revokeAllOther.isPending}>
                                Logga ut från andra enheter
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
