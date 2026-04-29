import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ConnectWhatsAppLayout } from "@/components/conversational/ConnectWhatsAppLayout";
import { WhatsAppConnectionPanel } from "@/components/conversational/WhatsAppConnectionPanel";

const ArenaConnectWhatsApp = () => {
  const { user, loading } = useAuth();
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("arenas")
        .select("id, tenant_id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (data) {
        setArenaId(data.id);
        setTenantId((data as any).tenant_id ?? null);
      }
      setResolving(false);
    })();
  }, [user]);

  if (loading || resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050708]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!arenaId) return <Navigate to="/" replace />;

  return (
    <ConnectWhatsAppLayout
      scopeLabel="Arena"
      title="Conecte o WhatsApp da arena e"
      highlight="atenda por conversa"
      subtitle="Reservas, check-ins, matrículas, cobranças, aulas e torneios acontecem pelo WhatsApp com a ORKYM."
      backHref="/arena/dashboard"
    >
      <WhatsAppConnectionPanel
        scope_type="arena"
        tenant_id={tenantId}
        arena_id={arenaId}
        title="Conexão da arena"
        description="A ORKYM passa a atender alunos, reservas, cobranças, check-ins e torneios por conversa."
        redirectOnSuccess="/arena/dashboard"
        valueBlocks={[
          { title: "Reservas e check-in", items: ["Reserva por mensagem", "Check-in por QR Code", "Lembretes automáticos"] },
          { title: "Aulas e mensalidades", items: ["Matrícula em segundos", "Cobrança automática", "Confirmação de presença"] },
          { title: "Torneios", items: ["Convite aos atletas", "Inscrições por chat", "Comunicados em massa"] },
          { title: "Atendimento", items: ["Histórico unificado", "Múltiplos professores", "Sem app extra"] },
        ]}
      />
    </ConnectWhatsAppLayout>
  );
};

export default ArenaConnectWhatsApp;
