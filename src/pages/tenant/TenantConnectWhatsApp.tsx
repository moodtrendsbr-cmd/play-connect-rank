import { useEffect, useState } from "react";
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
      scopeLabel="Rede · Tenant Admin"
      title="Conecte o WhatsApp da sua rede e"
      highlight="opere tudo por conversa"
      subtitle="Reservas, torneios, matrículas, cobranças, campanhas e atendimento acontecem pelo WhatsApp com a inteligência da ORKYM."
      backHref="/tenant/dashboard"
    >
      <WhatsAppConnectionPanel
        scope_type="tenant"
        tenant_id={tenant.id}
        title="Conexão da rede"
        description="Conecte o WhatsApp principal. A ORKYM coordena arenas, alertas, aprovações e operação conversacional."
        redirectOnSuccess="/tenant/dashboard"
        valueBlocks={[
          { title: "Operação da rede", items: ["Visão por arena", "Aprovações por chat", "Alertas em tempo real"] },
          { title: "Inteligência ORKYM", items: ["Decisões automatizadas", "Insights conversacionais", "Auditoria completa"] },
        ]}
      />
    </ConnectWhatsAppLayout>
  );
};

export default TenantConnectWhatsApp;
