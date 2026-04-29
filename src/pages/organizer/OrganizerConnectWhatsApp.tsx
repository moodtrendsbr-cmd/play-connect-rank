import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { ConnectWhatsAppLayout } from "@/components/conversational/ConnectWhatsAppLayout";
import { WhatsAppConnectionPanel } from "@/components/conversational/WhatsAppConnectionPanel";

const OrganizerConnectWhatsApp = () => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050708]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (userRole !== "organizer" && userRole !== "admin") return <Navigate to="/" replace />;

  return (
    <ConnectWhatsAppLayout
      scopeLabel="Organizador"
      title="Conecte o WhatsApp dos eventos e"
      highlight="organize por conversa"
      subtitle="Criação de torneios, inscrições, comunicados e check-ins acontecem pelo WhatsApp com a ORKYM."
      backHref="/organizer/dashboard"
    >
      <WhatsAppConnectionPanel
        scope_type="organizer"
        organizer_user_id={user.id}
        title="Conexão do organizador"
        description="A ORKYM ajuda a criar torneios, receber inscrições e orientar atletas."
        redirectOnSuccess="/organizer/dashboard"
        valueBlocks={[
          { title: "Torneios", items: ["Criação por mensagem", "Categorias dinâmicas", "Brackets automáticos"] },
          { title: "Inscrições", items: ["Pagamento integrado", "Confirmação por chat", "Listas atualizadas"] },
          { title: "Jogos e check-ins", items: ["Avisos aos atletas", "Resultados por chat", "Histórico completo"] },
        ]}
      />
    </ConnectWhatsAppLayout>
  );
};

export default OrganizerConnectWhatsApp;
