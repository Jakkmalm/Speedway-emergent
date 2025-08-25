import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNotifications, useUpdateNotifications } from "@/queries/account";
import { toast } from "sonner";

export default function NotificationsPanel() {
  const { data, isLoading } = useNotifications();
  const update = useUpdateNotifications();
  const [form, setForm] = useState({
    email: { match_created: true, protocol_saved: true, conflict_detected: true },
    push:  { match_created: true, protocol_saved: true, conflict_detected: true },
    quietHours: { start: "22:00", end: "07:00" },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const toggle = (path) => (checked) => {
    setForm((f) => {
      const next = { ...f };
      const [root, key] = path.split(".");
      next[root] = { ...next[root], [key]: checked };
      return next;
    });
  };

  const onSave = async () => {
    await toast.promise(update.mutateAsync(form), {
      loading: "Sparar…",
      success: "Notisinställningar uppdaterade",
      error: (e) => e?.message || "Kunde inte spara",
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Notiser</CardTitle></CardHeader>
      <CardContent className="grid gap-6">
        {isLoading ? (
          <div>Laddar…</div>
        ) : (
          <>
            <section className="grid gap-3">
              <Label>E-post</Label>
              <div className="flex items-center justify-between">
                <span>Match skapad</span>
                <Switch checked={!!form.email?.match_created} onCheckedChange={toggle("email.match_created")} />
              </div>
              <div className="flex items-center justify-between">
                <span>Protokoll sparat</span>
                <Switch checked={!!form.email?.protocol_saved} onCheckedChange={toggle("email.protocol_saved")} />
              </div>
              <div className="flex items-center justify-between">
                <span>Konflikt upptäckt</span>
                <Switch checked={!!form.email?.conflict_detected} onCheckedChange={toggle("email.conflict_detected")} />
              </div>
            </section>

            <section className="grid gap-3">
              <Label>Push</Label>
              <div className="flex items-center justify-between">
                <span>Match skapad</span>
                <Switch checked={!!form.push?.match_created} onCheckedChange={toggle("push.match_created")} />
              </div>
              <div className="flex items-center justify-between">
                <span>Protokoll sparat</span>
                <Switch checked={!!form.push?.protocol_saved} onCheckedChange={toggle("push.protocol_saved")} />
              </div>
              <div className="flex items-center justify-between">
                <span>Konflikt upptäckt</span>
                <Switch checked={!!form.push?.conflict_detected} onCheckedChange={toggle("push.conflict_detected")} />
              </div>
            </section>

            <section className="grid gap-3">
              <Label>Tysta timmar</Label>
              <div className="flex gap-2">
                <Input className="w-28" value={form.quietHours?.start || ""} onChange={(e)=>setForm(f=>({...f, quietHours:{...f.quietHours, start:e.target.value}}))} />
                <Input className="w-28" value={form.quietHours?.end || ""} onChange={(e)=>setForm(f=>({...f, quietHours:{...f.quietHours, end:e.target.value}}))} />
              </div>
            </section>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={update.isPending}>Spara</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
