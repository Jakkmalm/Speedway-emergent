import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccount, useUpdateProfile } from "@/queries/account";
import { toast } from "sonner";

export default function ProfilePanel() {
  const { data, isLoading } = useAccount();
  const update = useUpdateProfile();
  const [form, setForm] = useState({ display_name: "", username: "", email: "" });

  useEffect(() => {
    if (data) {
      setForm({
        display_name: data.display_name || "",
        username: data.username || "",
        email: data.email || "",
      });
    }
  }, [data]);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = async () => {
    await toast.promise(update.mutateAsync(form), {
      loading: "Sparar…",
      success: "Profil uppdaterad",
      error: (e) => e?.message || "Kunde inte spara",
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <div>Laddar…</div>
        ) : (
          <>
            <div>
              <label className="text-sm">Visningsnamn</label>
              <Input value={form.display_name} onChange={onChange("display_name")} />
            </div>
            <div>
              <label className="text-sm">Användarnamn</label>
              <Input value={form.username} onChange={onChange("username")} />
            </div>
            <div>
              <label className="text-sm">E-post</label>
              <Input type="email" value={form.email} onChange={onChange("email")} />
            </div>
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={update.isPending}>Spara</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
