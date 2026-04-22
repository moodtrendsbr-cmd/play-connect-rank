import { useAuth } from "@/contexts/AuthContext";
import { CommandsListView } from "@/components/conversational/CommandsListView";

export default function AdminCommands() {
  return <CommandsListView scope="global" title="Comandos · Visão global" />;
}
