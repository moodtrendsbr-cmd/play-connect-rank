import { useOutletContext } from "react-router-dom";
import { CommandsListView } from "@/components/conversational/CommandsListView";

export default function ArenaCommands() {
  const { arena } = useOutletContext<{ arena: any }>();
  if (!arena) return <p className="text-sm text-muted-foreground">Carregando arena…</p>;
  return (
    <CommandsListView
      scope="arena"
      scopeId={arena.id}
      title={`Comandos · ${arena.name}`}
    />
  );
}
