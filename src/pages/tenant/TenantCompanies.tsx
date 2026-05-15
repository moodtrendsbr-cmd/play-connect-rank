import ComingSoonPage from "@/components/common/ComingSoonPage";
import { Store } from "lucide-react";

export default function TenantCompanies() {
  return (
    <ComingSoonPage
      title="Empresas da rede"
      description="Visão consolidada das empresas parceiras da sua rede. Em preparação."
      icon={Store}
      backTo="/tenant/dashboard"
    />
  );
}
