import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { UnifiedFeedItem } from "@/hooks/useFeedUnified";

export default function BoostedProductCard({ item }: { item: UnifiedFeedItem }) {
  const [prod, setProd] = useState<{ name: string; price: number | null; image_url: string | null } | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (!item.target_id) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("name,price,image_url")
        .eq("id", item.target_id)
        .maybeSingle();
      if (data) setProd(data as any);
    })();
  }, [item.target_id]);

  useEffect(() => {
    if (item.campaign_id && !tracked.current) {
      tracked.current = true;
      supabase.rpc("ad_record_event", {
        _campaign_id: item.campaign_id,
        _slot_id: null,
        _event_type: "impression",
      } as any);
    }
  }, [item.campaign_id]);

  const handleClick = () => {
    if (item.campaign_id) {
      supabase.rpc("ad_record_event", {
        _campaign_id: item.campaign_id,
        _slot_id: null,
        _event_type: "click",
      } as any);
    }
  };

  if (!prod) return null;

  return (
    <Link
      to={`/marketplace/product/${item.target_id}`}
      onClick={handleClick}
      className="block rounded-xl overflow-hidden mb-4"
      style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.18)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <ShoppingBag className="h-4 w-4" style={{ color: "#2BFF88" }} />
        <span className="text-xs text-muted-foreground flex-1">
          {item.company_name || "Produto em destaque"}
        </span>
        <span
          className="text-[9px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(43,255,136,0.1)", color: "#2BFF88" }}
        >
          Impulsionado
        </span>
      </div>
      {prod.image_url ? (
        <img src={prod.image_url} alt={prod.name} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-24 bg-muted/30" />
      )}
      <div className="px-3 py-3">
        <h3 className="font-medium text-foreground text-sm">{prod.name}</h3>
        {prod.price != null && (
          <p className="text-xs text-muted-foreground mt-1">
            R$ {Number(prod.price).toFixed(2)}
          </p>
        )}
        <span className="inline-block mt-2 text-xs font-medium" style={{ color: "#2BFF88" }}>
          Ver produto →
        </span>
      </div>
    </Link>
  );
}
