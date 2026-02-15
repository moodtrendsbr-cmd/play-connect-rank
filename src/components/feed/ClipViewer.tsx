import { useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClipViewerProps {
  group: {
    author_name: string;
    author_avatar: string | null;
    clips: { id: string; media_url: string; caption: string | null; created_at: string; expires_at: string }[];
  };
  onClose: () => void;
}

const ClipViewer = ({ group, onClose }: ClipViewerProps) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = group.clips[index];

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (paused) videoRef.current.play();
    else videoRef.current.pause();
    setPaused(!paused);
  };

  const prev = () => { if (index > 0) { setIndex(index - 1); setPaused(false); } };
  const next = () => {
    if (index < group.clips.length - 1) { setIndex(index + 1); setPaused(false); }
    else onClose();
  };

  const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.95)" }}>
      {/* Progress bar */}
      <div className="absolute top-2 left-4 right-4 flex gap-1 z-10">
        {group.clips.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
            <div className="h-full rounded-full" style={{ background: i <= index ? "#2BFF88" : "transparent", width: "100%" }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {group.author_avatar ? (
            <img src={group.author_avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
              {getInitials(group.author_name)}
            </div>
          )}
          <span className="text-sm font-semibold text-white">{group.author_name}</span>
          <span className="text-xs" style={{ color: "#9CA3AF" }}>
            {formatDistanceToNow(new Date(clip.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        <button onClick={onClose} className="p-1">
          <X className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        key={clip.id}
        src={clip.media_url}
        className="max-h-[80vh] max-w-full rounded-lg"
        autoPlay
        playsInline
        onEnded={next}
        onClick={togglePlay}
      />

      {/* Play/Pause overlay */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="h-16 w-16 text-white/50" />
        </div>
      )}

      {/* Navigation */}
      {index > 0 && (
        <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 p-2">
          <ChevronLeft className="h-8 w-8 text-white/70" />
        </button>
      )}
      {index < group.clips.length - 1 && (
        <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 p-2">
          <ChevronRight className="h-8 w-8 text-white/70" />
        </button>
      )}

      {/* Caption */}
      {clip.caption && (
        <div className="absolute bottom-8 left-4 right-4 text-center">
          <p className="text-sm text-white bg-black/40 rounded-lg px-3 py-2 inline-block">{clip.caption}</p>
        </div>
      )}
    </div>
  );
};

export default ClipViewer;
