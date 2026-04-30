import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserCheck, QrCode, Package, Users } from "lucide-react";

interface Props { arenaId: string }

interface Step {
  key: string;
  icon: any;
  title: string;
  description: string;
  to: string;
  done: boolean;
}

export const NextStepsCard = ({ arenaId }: Props) => {
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    if (!arenaId) return;
    (async () => {
      const [arenaRes, qrRes, prodRes, staffRes] = await Promise.all([
        supabase.from("arenas").select("description, modalities, opening_hours").eq("id", arenaId).maybeSingle(),
        (supabase as any).from("wa_qr_tokens").select("id", { count: "exact", head: true }).eq("arena_id", arenaId),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("service_arena_id", arenaId),
        (supabase as any).from("arena_staff").select("id", { count: "exact", head: true }).eq("arena_id", arenaId),
      ]);

      const a: any = arenaRes.data || {};
      const profileComplete = !!a.description && Array.isArray(a.modalities) && a.modalities.length > 0;
      const hasQr = (qrRes as any).count > 0;
      const hasProduct = (prodRes.count || 0) > 0;
      const hasStaff = (staffRes as any).count > 0;

      setSteps([
        { key: "profile",  icon: UserCheck, title: "Completar perfil da arena", description: "Adicione descrição e modalidades.", to: "/arena/dashboard/perfil", done: profileComplete },
        { key: "qr",       icon: QrCode,    title: "Gerar primeiro QR físico",  description: "Cole na recepção, mesas, quadras.",  to: "/arena/dashboard/qr",     done: hasQr },
        { key: "product",  icon: Package,   title: "Cadastrar primeiro produto",description: "Lojinha, bar, aluguel ou serviços.", to: "/arena/dashboard/produtos", done: hasProduct },
        { key: "team",     icon: Users,     title: "Convidar funcionário",      description: "Recepção, professor, financeiro.",  to: "/arena/dashboard/equipe", done: hasStaff },
      ]);
    })();
  }, [arenaId]);

  if (!steps) return null;
  const pending = steps.filter((s) => !s.done);
  if (pending.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Próximos passos da arena</h2>
          <p className="text-xs text-muted-foreground">Termine sua configuração para liberar todas as funcionalidades.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {pending.map((s) => (
            <Link key={s.key} to={s.to} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 transition-colors group">
              <s.icon className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
