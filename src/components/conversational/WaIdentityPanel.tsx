import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle2, AlertCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { registerWaIdentity, verifyWaIdentity, getWaNumber, isWaConfigured } from "@/lib/wa";

interface Props {
  userId: string;
}

interface Identity {
  id: string;
  wa_phone: string;
  default_profile_type: string;
  verified_at: string | null;
  verification_code: string | null;
  verification_expires_at: string | null;
}

const PROFILES = [
  { value: "athlete", label: "Atleta" },
  { value: "arena", label: "Arena (operador)" },
  { value: "organizer", label: "Organizador" },
  { value: "company", label: "Empresa" },
  { value: "tenant", label: "Rede (tenant)" },
];

export const WaIdentityPanel = ({ userId }: Props) => {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [profile, setProfile] = useState("athlete");
  const [verifyCode, setVerifyCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("wa_identities")
      .select("id, wa_phone, default_profile_type, verified_at, verification_code, verification_expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setIdentity((data as Identity) || null);
    if (data?.wa_phone) setPhone(data.wa_phone);
    if (data?.default_profile_type) setProfile(data.default_profile_type);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const handleRegister = async () => {
    setBusy(true);
    const result = await registerWaIdentity(phone, profile);
    setBusy(false);
    if (!result) {
      toast.error("Não foi possível registrar. Verifique o número.");
      return;
    }
    setPendingCode(result.verification_code);
    toast.success("Código gerado! Envie pelo WhatsApp para confirmar.");
    load();
  };

  const handleVerify = async () => {
    setBusy(true);
    const ok = await verifyWaIdentity(phone, verifyCode);
    setBusy(false);
    if (!ok) {
      toast.error("Código inválido ou expirado.");
      return;
    }
    toast.success("WhatsApp verificado!");
    setPendingCode(null);
    setVerifyCode("");
    load();
  };

  const orkymNumber = getWaNumber();
  const verified = identity?.verified_at != null;
  const codeToShow = pendingCode || identity?.verification_code;

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          WhatsApp da ORKYM
          {verified && (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Verificado
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : verified ? (
          <div className="space-y-2">
            <p className="text-sm">
              Conectado como <span className="font-medium">+{identity?.wa_phone}</span>
              {" "}— perfil padrão: <span className="font-medium">{
                PROFILES.find(p => p.value === identity?.default_profile_type)?.label || identity?.default_profile_type
              }</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Envie comandos para o WhatsApp da ORKYM (+{orkymNumber}). Eles aparecem no card "Últimos comandos" do seu painel em tempo real.
            </p>
          </div>
        ) : (
          <>
            {!isWaConfigured() && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  WhatsApp da ORKYM ainda não configurado em produção. Você pode registrar mesmo assim — assim que configurarmos, sua identidade já estará pronta.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="wa-phone" className="text-xs">Seu número (com DDD/DDI, só dígitos)</Label>
              <Input
                id="wa-phone"
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Perfil padrão para comandos</Label>
              <Select value={profile} onValueChange={setProfile} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROFILES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!codeToShow ? (
              <Button
                onClick={handleRegister}
                disabled={busy || phone.length < 10}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Gerar código de verificação
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-md bg-card border border-emerald-500/30 space-y-1.5">
                  <p className="text-xs text-muted-foreground">Seu código (válido por 10min):</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-2xl font-mono tracking-widest text-emerald-600">{codeToShow}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(`verificar ${codeToShow}`);
                        toast.success("Comando copiado");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Envie <code className="bg-muted px-1 rounded">verificar {codeToShow}</code> para o WhatsApp da ORKYM (+{orkymNumber}), depois cole o código abaixo.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-code" className="text-xs">Código de 6 dígitos</Label>
                  <Input
                    id="wa-code"
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                  />
                </div>
                <Button
                  onClick={handleVerify}
                  disabled={busy || verifyCode.length !== 6}
                  className="w-full"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirmar verificação
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
