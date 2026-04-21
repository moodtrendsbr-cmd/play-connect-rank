import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Ad {
  id: string;
  title: string | null;
  image_url: string | null;
  link: string | null;
  cta_label: string | null;
  slot_id: string;
  company_name: string | null;
  company_logo: string | null;
  priority: number;
}

interface AdSlotProps {
  code: string;
  className?: string;
}

export default function AdSlot({ code, className = "" }: AdSlotProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("ads_public")
        .select("*")
        .eq("slot_code", code)
        .order("priority", { ascending: false })
        .limit(1);
      if (active && data && data.length > 0) setAd(data[0] as Ad);
    })();
    return () => { active = false; };
  }, [code]);

  useEffect(() => {
    if (ad && !tracked.current) {
      tracked.current = true;
      supabase.rpc("ad_record_event", {
        _campaign_id: ad.id,
        _slot_id: ad.slot_id,
        _event_type: "impression",
      });
    }
  }, [ad]);

  if (!ad) return null;

  const handleClick = () => {
    supabase.rpc("ad_record_event", {
      _campaign_id: ad.id,
      _slot_id: ad.slot_id,
      _event_type: "click",
    });
  };

  const content = (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      {ad.image_url && (
        <img src={ad.image_url} alt={ad.title || ""} className="w-full h-32 object-cover" />
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Patrocinado</span>
          {ad.company_name && <span className="text-xs text-muted-foreground">{ad.company_name}</span>}
        </div>
        {ad.title && <h4 className="text-sm font-semibold text-foreground">{ad.title}</h4>}
        {ad.cta_label && (
          <span className="inline-block mt-2 text-xs font-medium text-primary">{ad.cta_label} →</span>
        )}
      </div>
    </div>
  );

  return ad.link ? (
    <a href={ad.link} target="_blank" rel="noopener sponsored" onClick={handleClick}>
      {content}
    </a>
  ) : (
    <div onClick={handleClick}>{content}</div>
  );
}
