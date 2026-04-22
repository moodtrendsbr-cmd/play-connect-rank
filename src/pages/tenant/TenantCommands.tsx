import { useTenant } from "@/hooks/useTenant";
import { CommandsListView } from "@/components/conversational/CommandsListView";

export default function TenantCommands() {
  const { tenant } = useTenant();
  if (!tenant) return <p className="text-sm text-muted-foreground">Carregando rede…</p>;
  return (
    <CommandsListView
      scope="tenant"
      scopeId={tenant.id}
      title={`Comandos da rede · ${tenant.name}`}
    />
  );
}
