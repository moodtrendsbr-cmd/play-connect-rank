import ComingSoonPage from "@/components/common/ComingSoonPage";
import { ClipboardList } from "lucide-react";

export default function OrganizerEnrollments() {
  return (
    <ComingSoonPage
      title="Inscritos"
      description="Painel unificado de inscritos por torneio. Em preparação."
      icon={ClipboardList}
      backTo="/organizer/dashboard"
    />
  );
}
