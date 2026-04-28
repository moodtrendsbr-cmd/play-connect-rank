import { useOutletContext } from "react-router-dom";
import { ScopedMessages } from "@/pages/conversational/ScopedMessages";

export default function ArenaMessages() {
  const { arena } = useOutletContext<{ arena: any }>();
  if (!arena) return <p className="text-sm text-muted-foreground">Carregando arena…</p>;
  return <ScopedMessages scope="arena" scopeId={arena.id} title={`Mensagens · ${arena.name}`} />;
}
