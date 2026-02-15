import { Store } from "lucide-react";
import { Link } from "react-router-dom";

interface SponsoredPostCardProps {
  post: {
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    company_id: string;
    company_name?: string;
    company_logo?: string;
  };
}

const SponsoredPostCard = ({ post }: SponsoredPostCardProps) => {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.08)" }}>
      <div className="flex items-center gap-2 px-3 py-2">
        {post.company_logo ? (
          <img src={post.company_logo} className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <Store className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground flex-1">{post.company_name || "Patrocinador"}</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(43,255,136,0.1)", color: "#2BFF88" }}>
          Patrocinado
        </span>
      </div>
      {post.image_url && (
        <img src={post.image_url} alt={post.title} className="w-full h-48 object-cover" />
      )}
      <div className="px-3 py-3">
        <h3 className="font-medium text-foreground text-sm">{post.title}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
        <Link
          to={`/marketplace/company/${post.company_id}`}
          className="inline-block mt-2 text-xs font-medium"
          style={{ color: "#2BFF88" }}
        >
          Ver empresa →
        </Link>
      </div>
    </div>
  );
};

export default SponsoredPostCard;
