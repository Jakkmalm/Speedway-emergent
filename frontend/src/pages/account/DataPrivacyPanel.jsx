import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useExportMyData, useDeleteAccount } from "@/queries/account";
import { toast } from "sonner";

export default function DataPrivacyPanel() {
  const exportData = useExportMyData();
  const del = useDeleteAccount();
  const [confirm, setConfirm] = useState("");

  const onExport = async () => {
    const blob = await exportData.mutateAsync();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speedway-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDelete = async () => {
    if (confirm !== "RADERA") {
      toast("Skriv RADERA för att bekräfta");
      return;
    }
    await toast.promise(del.mutateAsync({ password: "" /* be om lösen om din backend kräver */ }), {
      loading: "Tar bort konto…",
      success: "Konto borttaget",
      error: (e) => e?.message || "Kunde inte ta bort kontot",
    });
    // TODO: navigera till /logout eller rensa QueryClient
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Exportera mina data</CardTitle></CardHeader>
        <CardContent className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Ladda ned dina data som JSON för eget bruk.</div>
          <Button onClick={onExport} disabled={exportData.isPending}>Exportera</Button>
        </CardContent>
      </Card>

      <Card className="border-red-300">
        <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            Raderar ditt konto och tillhörande data. Kan inte ångras.
          </div>
          <Input placeholder='Skriv "RADERA" för att bekräfta' value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
          <div className="flex justify-end">
            <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
              Ta bort konto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
