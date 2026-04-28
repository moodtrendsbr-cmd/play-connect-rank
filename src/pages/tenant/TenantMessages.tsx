import { useTenant } from "@/hooks/useTenant";
import { ScopedMessages } from "@/pages/conversational/ScopedMessages";

export default function TenantMessages() {
  const { tenant } = useTenant();
  return <ScopedMessages scope="tenant" scopeId={tenant?.id ?? null} title="Mensagens WhatsApp" />;
}
