import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Account {
  id: string;
  provider: string;
  external_id: string;
  status: string;
  arena_id: string | null;
}

const OrganizerPayment = () => {
  const { tenant } = useTenant();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState("");

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from("payment_accounts")
      .select("id, provider, external_id, status, arena_id")
      .eq("tenant_id", tenant.id)
      .order("created_at");
    setAccounts((data as Account[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id]);

  const addAccount = async () => {
    if (!tenant || !newId.trim()) return;
    const { error } = await supabase.from("payment_accounts").insert({
      tenant_id: tenant.id,
      provider: "mercadopago",
      external_id: newId.trim(),
      status: "active",
    });
    if (error) toast.error(error.message);
    else { toast.success("Conta de pagamento adicionada"); setNewId(""); load(); }
  };

  const removeAccount = async (id: string) => {
    if (!confirm("Remover esta conta?")) return;
    const { error } = await supabase.from("payment_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos</h1>
        <p className="text-sm text-muted-foreground">Contas de gateway vinculadas ao organizador</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Adicionar conta Mercado Pago</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2">
          <Input placeholder="Collector ID do Mercado Pago" value={newId} onChange={(e) => setNewId(e.target.value)} className="flex-1" />
          <Button onClick={addAccount}>Adicionar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contas ativas ({accounts.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma conta de pagamento configurada</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{a.external_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.provider} {a.arena_id ? "· vinculada a arena" : "· organizador"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeAccount(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizerPayment;
