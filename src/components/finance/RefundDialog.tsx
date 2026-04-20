import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId: string;
  totalAmount: number;
  refundedAmount: number;
  onSuccess?: () => void;
}

const RefundDialog = ({ open, onOpenChange, transactionId, totalAmount, refundedAmount, onSuccess }: Props) => {
  const remaining = Number(totalAmount) - Number(refundedAmount || 0);
  const [amount, setAmount] = useState<string>(remaining.toFixed(2));
  const [reason, setReason] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return toast.error("Valor inválido");
    if (parsed > remaining) return toast.error(`Valor excede o disponível (R$ ${remaining.toFixed(2)})`);
    if (!reason.trim()) return toast.error("Motivo é obrigatório");

    setLoading(true);
    const { error } = await supabase.rpc("finance_record_refund", {
      _transaction_id: transactionId,
      _amount: parsed,
      _reason: reason.trim(),
      _external_ref: externalRef.trim() || null,
    });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success("Reembolso registrado");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" /> Registrar reembolso
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">R$ {Number(totalAmount).toFixed(2)}</span>
            {refundedAmount > 0 && (
              <> · Já reembolsado: <span className="font-semibold text-foreground">R$ {Number(refundedAmount).toFixed(2)}</span></>
            )}
            <> · Disponível: <span className="font-semibold text-primary">R$ {remaining.toFixed(2)}</span></>
          </div>
          <div>
            <Label>Valor do reembolso (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Motivo *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justificativa obrigatória" rows={3} />
          </div>
          <div>
            <Label>Referência externa (opcional)</Label>
            <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="ex: ID do estorno no PSP" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Processando..." : "Confirmar reembolso"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefundDialog;
