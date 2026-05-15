import ComingSoonPage from "@/components/common/ComingSoonPage";
import { Swords } from "lucide-react";

export default function OrganizerGames() {
  return (
    <ComingSoonPage
      title="Jogos"
      description="Calendário consolidado de jogos dos seus torneios. Em preparação."
      icon={Swords}
      backTo="/organizer/dashboard"
    />
  );
}
