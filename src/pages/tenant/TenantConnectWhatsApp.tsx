import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { Loader2 } from "lucide-react";
import { ConnectWhatsAppLayout } from "@/components/conversational/ConnectWhatsAppLayout";
import { WhatsAppConnectionPanel } from "@/components/conversational/WhatsAppConnectionPanel";

const TenantConnectWhatsApp = () => {
  const { user, loading } = useAuth();
  const { tenant, isLoading } = useTenant();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050708]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!tenant) return <Navigate to="/organizer/onboarding" replace />;

  return (
    <ConnectWhatsAppLayout
      scopeLabel="Comunicação da rede"
      title="Conecte o WhatsApp da sua rede e"
      highlight="centralize a comunicação"
      subtitle="Esse é o número principal pelo qual sua rede conversa com atletas, arenas, organizadores e patrocinadores."
      backHref="/tenant/dashboard"
    >
      <WhatsAppConnectionPanel
        scope_type="tenant"
        tenant_id={tenant.id}
        title="WhatsApp da rede"
        description="Conecte um número para que sua rede tenha um canal único de comunicação."
        redirectOnSuccess="/tenant/dashboard"
        valueBlocks={[
          { title: "O que aparece aqui", items: ["Número conectado", "Status atual", "Última sincronização"] },
          { title: "O que você pode fazer", items: ["Ler o QR para conectar", "Reconectar quando precisar", "Atualizar o status manualmente"] },
        ]}
      />
    </ConnectWhatsAppLayout>
  );
};

export default TenantConnectWhatsApp;
