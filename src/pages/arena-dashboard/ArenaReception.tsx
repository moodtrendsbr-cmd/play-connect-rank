import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Search, UserPlus, MessageCircle } from "lucide-react";
import { useArenaCheckinsLive } from "@/hooks/useArenaCheckinsLive";
import { NowEnteringBlock } from "@/components/arena/reception/NowEnteringBlock";
import { ArrivingBlock } from "@/components/arena/reception/ArrivingBlock";
import { UpcomingClassesBlock } from "@/components/arena/reception/UpcomingClassesBlock";
import { ActiveTournamentsBlock } from "@/components/arena/reception/ActiveTournamentsBlock";
import { MainQRCard } from "@/components/arena/reception/MainQRCard";
import { ManualPresenceDialog } from "@/components/arena/reception/ManualPresenceDialog";
import { LocateBookingDialog } from "@/components/arena/reception/LocateBookingDialog";

const ArenaReception = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const { items: checkins, refresh } = useArenaCheckinsLive(arena?.id);
  const [openManual, setOpenManual] = useState(false);
  const [openLocate, setOpenLocate] = useState(false);

  if (!arena) return null;

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl tracking-wide text-foreground">RECEPÇÃO</h1>
            <Badge className="bg-primary/15 text-primary border-0 text-[10px] tracking-widest animate-pulse">AO VIVO</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Tudo o que está acontecendo agora na arena.</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border md:static md:mx-0 md:px-0 md:border-0 md:bg-transparent md:backdrop-blur-0">
        <div className="flex gap-1.5 overflow-x-auto md:flex-wrap">
          <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
            <Link to="/arena/dashboard/qr"><QrCode className="h-4 w-4" /> Abrir QR</Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setOpenLocate(true)}>
            <Search className="h-4 w-4" /> Localizar reserva
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setOpenManual(true)}>
            <UserPlus className="h-4 w-4" /> Registrar presença
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
            <Link to="/arena/dashboard/mensagens-wa"><MessageCircle className="h-4 w-4" /> Conversas</Link>
          </Button>
        </div>
      </div>

      <MainQRCard arena={arena} />
      <NowEnteringBlock items={checkins} />
      <ArrivingBlock arenaId={arena.id} checkins={checkins} />
      <UpcomingClassesBlock arenaId={arena.id} />
      <ActiveTournamentsBlock arenaId={arena.id} />

      <ManualPresenceDialog open={openManual} onClose={() => setOpenManual(false)} arena={arena} onSaved={refresh} />
      <LocateBookingDialog open={openLocate} onClose={() => setOpenLocate(false)} arenaId={arena.id} />
    </div>
  );
};

export default ArenaReception;
