import { useAuth } from "@/contexts/AuthContext";
import { CommandsListView } from "@/components/conversational/CommandsListView";

export default function OrganizerCommands() {
  const { user } = useAuth();
  return (
    <CommandsListView
      scope="user"
      scopeId={user?.id}
      title="Comandos · Operação de eventos"
    />
  );
}
