import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props { open: boolean; onClose: () => void; arena: any; onSaved: () => void; }

const sportsDefault = ["Beach Tennis", "Padel", "Vôlei", "Futevôlei"];

export const ManualPresenceDialog = ({ open, onClose, arena, onSaved }: Props) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sports = (arena?.modalities && arena.modalities.length) ? arena.modalities : sportsDefault;

  const save = async () => {
    if (!phone.replace(/\D/g, "")) { toast.error("Informe o WhatsApp"); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("arena-public-checkin", {
      body: {
        action: "complete",
        arena_id: arena.id,
        phone: phone.replace(/\D/g, ""),
        name: name || null,
        sport,
        source: "manual",
      },
    });
    setSaving(false);
    if (error || !(data as any)?.success) { toast.error("Não foi possível registrar"); return; }
    toast.success("Presença registrada");
    setName(""); setPhone(""); setSport(null);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar presença</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como chamar" />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>Esporte</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {sports.map((s: string) => (
                <Button key={s} type="button" variant={sport === s ? "default" : "outline"} size="sm"
                  onClick={() => setSport(s)}>{s}</Button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>Confirmar entrada</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
