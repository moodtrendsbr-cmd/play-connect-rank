import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Globe, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props { userId: string; }

export const SocialPrivacyToggle = ({ userId }: Props) => {
  const [visibility, setVisibility] = useState<"public" | "private" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      // ensure identity exists, then read visibility
      await (supabase as any).rpc("social_identity_for_user", { _user_id: userId });
      const { data } = await (supabase as any)
        .from("social_profiles")
        .select("visibility, social_identities!inner(user_id)")
        .eq("social_identities.user_id", userId)
        .maybeSingle();
      setVisibility((data?.visibility as any) || "public");
    })();
  }, [userId]);

  const toggle = async (checked: boolean) => {
    const next = checked ? "public" : "private";
    setBusy(true);
    const { error } = await (supabase as any).rpc("social_profile_set_visibility", { _visibility: next });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível atualizar");
      return;
    }
    setVisibility(next);
    toast.success(next === "public" ? "Perfil público" : "Perfil privado");
  };

  if (visibility === null) return null;

  return (
    <Card className="bg-card/60 border-border/40 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {visibility === "public" ? (
          <Globe className="h-5 w-5 text-[#2BFF88]" />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">Perfil social</p>
          <p className="text-xs text-muted-foreground">
            {visibility === "public"
              ? "Sua atividade aparece no feed da rede"
              : "Sua atividade fica oculta da rede"}
          </p>
        </div>
      </div>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch checked={visibility === "public"} onCheckedChange={toggle} />
      )}
    </Card>
  );
};
