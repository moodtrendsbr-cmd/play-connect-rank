import { useAuth } from "@/contexts/AuthContext";
import { CommandsListView } from "@/components/conversational/CommandsListView";

export default function CompanyCommands() {
  const { user } = useAuth();
  return (
    <CommandsListView
      scope="user"
      scopeId={user?.id}
      title="Comandos comerciais"
    />
  );
}
