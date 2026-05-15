import ComingSoonPage from "@/components/common/ComingSoonPage";
import { Trophy } from "lucide-react";

export default function OrganizerEvents() {
  return (
    <ComingSoonPage
      title="Eventos"
      description="Gestão dedicada de eventos do organizador. Em breve você verá aqui todos os seus torneios em um só lugar."
      icon={Trophy}
      ctaLabel="Criar torneio"
      ctaTo="/tournaments/create"
      backTo="/organizer/dashboard"
    />
  );
}
