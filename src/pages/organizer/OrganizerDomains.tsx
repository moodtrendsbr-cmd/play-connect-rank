import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Domain {
  id: string;
  domain: string;
  kind: "subdomain" | "custom";
  is_primary: boolean;
  verification_status: "pending" | "verified" | "failed";
}

const OrganizerDomains = () => {
  const { tenant } = useTenant();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newKind, setNewKind] = useState<"subdomain" | "custom">("custom");

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from("tenant_domains")
      .select("id, domain, kind, is_primary, verification_status")
      .eq("tenant_id", tenant.id)
      .order("created_at");
    setDomains((data as Domain[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id]);

  const addDomain = async () => {
    if (!tenant || !newDomain.trim()) return;
    const { error } = await supabase.from("tenant_domains").insert({
      tenant_id: tenant.id,
      domain: newDomain.trim().toLowerCase(),
      kind: newKind,
      verification_status: "pending",
    });
    if (error) toast.error(error.message);
    else { toast.success("Domínio adicionado (pendente de verificação)"); setNewDomain(""); load(); }
  };

  const removeDomain = async (id: string) => {
    if (!confirm("Remover este domínio?")) return;
    const { error } = await supabase.from("tenant_domains").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Domínios</h1>
        <p className="text-sm text-muted-foreground">Hosts que apontam para este organizador</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Adicionar domínio</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2">
          <Input placeholder="meusite.com.br" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="flex-1" />
          <Select value={newKind} onValueChange={(v) => setNewKind(v as any)}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="subdomain">Subdomínio</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addDomain}>Adicionar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Domínios ({domains.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum domínio configurado</p>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{d.domain}</p>
                    <p className="text-xs text-muted-foreground">{d.kind}{d.is_primary ? " · primário" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.verification_status === "verified" ? "default" : d.verification_status === "failed" ? "destructive" : "secondary"}>
                      {d.verification_status}
                    </Badge>
                    {!d.is_primary && (
                      <Button variant="ghost" size="icon" onClick={() => removeDomain(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Verificação automática via DNS será implementada na Fase 3. Por enquanto, contate o suporte para verificar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizerDomains;
