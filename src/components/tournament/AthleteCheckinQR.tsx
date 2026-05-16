import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode } from "lucide-react";
import QRCodeLib from "qrcode";

interface Props {
  enrollmentId: string;
  compact?: boolean;
}

/**
 * Athlete check-in QR. Fetches the enrollment's checkin_token via RLS,
 * never displays the raw token, just renders the QR.
 */
const AthleteCheckinQR = ({ enrollmentId, compact = false }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("enrollments")
        .select("checkin_token")
        .eq("id", enrollmentId)
        .maybeSingle();
      if (alive) {
        setToken((data as any)?.checkin_token ?? null);
        setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [enrollmentId]);

  useEffect(() => {
    if (ref.current && token) {
      const url = `${window.location.origin}/checkin?token=${token}`;
      QRCodeLib.toCanvas(ref.current, url, { width: compact ? 160 : 220, margin: 1 }).catch(() => {});
    }
  }, [token, compact]);

  if (loading) return <Skeleton className={compact ? "h-40 w-40" : "h-56 w-56"} />;
  if (!token) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Check-in indisponível para esta inscrição.
      </p>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <QrCode className="h-3.5 w-3.5" /> Meu QR de check-in
        </p>
        <div className="bg-white p-3 rounded-md">
          <canvas ref={ref} />
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          Apresente na entrada do torneio.
        </p>
      </CardContent>
    </Card>
  );
};

export default AthleteCheckinQR;
