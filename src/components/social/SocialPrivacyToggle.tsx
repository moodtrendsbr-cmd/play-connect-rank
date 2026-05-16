import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Globe, Lock, Loader2, EyeOff, Trophy, Activity } from "lucide-react";
import { toast } from "sonner";

interface Props { userId: string; }

interface ProfileFlags {
  visibility: "public" | "private";
  hide_checkins: boolean;
  hide_ranking: boolean;
  hide_activity: boolean;
  profile_id?: string;
}

export const SocialPrivacyToggle = ({ userId }: Props) => {
  const [flags, setFlags] = useState<ProfileFlags | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    await (supabase as any).rpc("social_identity_for_user", { _user_id: userId });
    const { data } = await (supabase as any)
      .from("social_profiles")
      .select("id, visibility, hide_checkins, hide_ranking, hide_activity, social_identities!inner(user_id)")
      .eq("social_identities.user_id", userId)
      .maybeSingle();
    setFlags({
      visibility: (data?.visibility as any) || "public",
      hide_checkins: !!data?.hide_checkins,
      hide_ranking: !!data?.hide_ranking,
      hide_activity: !!data?.hide_activity,
      profile_id: data?.id,
    });
  };

  useEffect(() => { load(); }, [userId]);

  const toggleVisibility = async (checked: boolean) => {
    const next = checked ? "public" : "private";
    setBusy("visibility");
    const { error } = await (supabase as any).rpc("social_profile_set_visibility", { _visibility: next });
    setBusy(null);
    if (error) { toast.error("Não foi possível atualizar"); return; }
    setFlags((f) => f ? { ...f, visibility: next } : f);
    toast.success(next === "public" ? "Perfil público" : "Perfil privado");
  };

  const toggleFlag = async (field: "hide_checkins" | "hide_ranking" | "hide_activity", checked: boolean) => {
    if (!flags?.profile_id) return;
    setBusy(field);
    const { error } = await (supabase as any).from("social_profiles").update({ [field]: checked }).eq("id", flags.profile_id);
    setBusy(null);
    if (error) { toast.error("Não foi possível atualizar"); return; }
    setFlags((f) => f ? { ...f, [field]: checked } : f);
    toast.success("Preferência salva");
  };

  if (!flags) return null;

  const Row = ({ icon, title, subtitle, checked, onChange, busyKey }: any) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {busy === busyKey ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Switch checked={checked} onCheckedChange={onChange} />}
    </div>
  );

  return (
    <Card className="bg-card/60 border-border/40 p-4 space-y-1">
      <Row
        icon={flags.visibility === "public" ? <Globe className="h-5 w-5 text-[#2BFF88]" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
        title="Perfil social"
        subtitle={flags.visibility === "public" ? "Sua atividade aparece no feed" : "Sua atividade fica oculta"}
        checked={flags.visibility === "public"}
        onChange={toggleVisibility}
        busyKey="visibility"
      />
      <div className="border-t border-border/30" />
      <Row
        icon={<EyeOff className="h-5 w-5 text-muted-foreground" />}
        title="Ocultar check-ins"
        subtitle="Seus check-ins em arenas ficam privados"
        checked={flags.hide_checkins}
        onChange={(v: boolean) => toggleFlag("hide_checkins", v)}
        busyKey="hide_checkins"
      />
      <Row
        icon={<Trophy className="h-5 w-5 text-muted-foreground" />}
        title="Ocultar ranking"
        subtitle="Sua posição não aparece em rankings públicos"
        checked={flags.hide_ranking}
        onChange={(v: boolean) => toggleFlag("hide_ranking", v)}
        busyKey="hide_ranking"
      />
      <Row
        icon={<Activity className="h-5 w-5 text-muted-foreground" />}
        title="Ocultar atividade"
        subtitle="Vitórias, pódios e XP ficam privados"
        checked={flags.hide_activity}
        onChange={(v: boolean) => toggleFlag("hide_activity", v)}
        busyKey="hide_activity"
      />
    </Card>
  );
};
