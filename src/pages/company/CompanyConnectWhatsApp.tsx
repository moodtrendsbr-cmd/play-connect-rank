import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ConnectWhatsAppLayout } from "@/components/conversational/ConnectWhatsAppLayout";
import { WhatsAppConnectionPanel } from "@/components/conversational/WhatsAppConnectionPanel";

const CompanyConnectWhatsApp = () => {
  const { user, loading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (data?.id) setCompanyId(data.id);
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
  if (!companyId) return <Navigate to="/marketplace/register" replace />;

  return (
    <ConnectWhatsAppLayout
      scopeLabel="Empresa"
      title="Conecte o WhatsApp da empresa e"
      highlight="venda por conversa"
      subtitle="Campanhas, marketplace, pedidos e atendimento acontecem pelo WhatsApp com a ORKYM."
      backHref="/company/dashboard"
    >
      <WhatsAppConnectionPanel
        scope_type="company"
        company_id={companyId}
        title="Conexão da empresa"
        description="A ORKYM ajuda a vender, anunciar e responder clientes pelo marketplace."
        redirectOnSuccess="/company/dashboard"
        valueBlocks={[
          { title: "Campanhas", items: ["Disparos segmentados", "Cupons por chat", "Métricas em tempo real"] },
          { title: "Marketplace", items: ["Pedidos por mensagem", "Status automático", "Pós-venda integrado"] },
          { title: "Performance", items: ["Funil conversacional", "ROI por campanha", "Insights ORKYM"] },
        ]}
      />
    </ConnectWhatsAppLayout>
  );
};

export default CompanyConnectWhatsApp;
