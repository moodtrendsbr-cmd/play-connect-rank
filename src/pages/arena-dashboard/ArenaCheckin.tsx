import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, QrCode } from "lucide-react";

const errorMessages: Record<string, string> = {
  auth_required: "Você precisa estar logado para fazer check-in.",
  invalid_token: "QR Code inválido.",
  expired_token: "QR Code expirado. Peça um novo na recepção.",
  class_not_found: "Aula não encontrada.",
  not_a_student: "Você não está cadastrado como aluno desta arena.",
  not_enrolled: "Você não está matriculado nesta aula.",
};

const ArenaCheckin = () => {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [classTitle, setClassTitle] = useState("");

  const token = params.get("t") || "";

  useEffect(() => {
    if (authLoading) return;
    if (!token) { setState("error"); setMessage("Token ausente."); return; }
    if (!user) { navigate(`/login?redirect=/arena/checkin?t=${token}`, { replace: true }); return; }

    (async () => {
      const { data, error } = await supabase.rpc("arena_checkin_validate", { _token: token });
      if (error) { setState("error"); setMessage(error.message); return; }
      const result = data as any;
      if (result?.success) {
        setState("success");
        setClassTitle(result.class_title || "");
      } else {
        setState("error");
        setMessage(errorMessages[result?.error] || "Erro ao validar check-in.");
      }
    })();
  }, [token, user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="bg-card border-border w-full max-w-sm">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
          </div>
          {state === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Validando check-in...</p>
            </>
          )}
          {state === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-xl font-display text-foreground">Check-in confirmado</h1>
              {classTitle && <p className="text-sm text-muted-foreground">{classTitle}</p>}
              <Link to="/feed"><Button className="w-full">Voltar ao feed</Button></Link>
            </>
          )}
          {state === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-xl font-display text-foreground">Check-in não realizado</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Link to="/feed"><Button variant="outline" className="w-full">Voltar</Button></Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ArenaCheckin;
