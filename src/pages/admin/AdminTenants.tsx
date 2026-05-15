import ComingSoonPage from "@/components/common/ComingSoonPage";
import { Building2 } from "lucide-react";

export default function AdminTenants() {
  return (
    <ComingSoonPage
      title="Tenants"
      description="Gestão de redes (tenants) separada da gestão de arenas. Em preparação."
      icon={Building2}
      backTo="/admin"
    />
  );
}
