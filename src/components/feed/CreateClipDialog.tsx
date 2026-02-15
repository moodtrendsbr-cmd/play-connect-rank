import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Upload, Circle, Square, Trash2 } from "lucide-react";

interface CreateClipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CreateClipDialog = ({ open, onOpenChange, onCreated }: CreateClipDialogProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live recording state
  const [tab, setTab] = useState<"upload" | "record">("upload");
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [timer, setTimer] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!open) {
      stopStream();
      setTab("upload");
      setRecordedBlob(null);
      setTimer(0);
      setRecording(false);
    }
  }, [open]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
    } catch {
      toast({ title: "Não foi possível acessar a câmera", variant: "destructive" });
      setTab("upload");
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      stopStream();
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setRecording(true);
    setTimer(0);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev >= 59) { mr.stop(); setRecording(false); return 60; }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setTimer(0);
    startCamera();
  };

  useEffect(() => {
    if (tab === "record" && open) startCamera();
    if (tab === "upload") stopStream();
  }, [tab, open]);

  const getFileForUpload = (): File | null => {
    if (tab === "upload") return file;
    if (recordedBlob) return new File([recordedBlob], `clip_${Date.now()}.webm`, { type: "video/webm" });
    return null;
  };

  const handleSubmit = async () => {
    const uploadFile = getFileForUpload();
    if (!user || !uploadFile) return;
    setUploading(true);

    const ext = uploadFile.name.split(".").pop();
    const path = `clips/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("post-images").upload(path, uploadFile);
    if (upErr) { toast({ title: "Erro no upload", variant: "destructive" }); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);

    const { error } = await supabase.from("clips").insert({
      author_id: user.id,
      media_url: urlData.publicUrl,
      caption: caption || null,
    } as any);

    if (error) { toast({ title: "Erro ao criar clip", variant: "destructive" }); setUploading(false); return; }

    toast({ title: "Clip publicado!" });
    setFile(null);
    setCaption("");
    setRecordedBlob(null);
    setUploading(false);
    onOpenChange(false);
    onCreated();
  };

  const canSubmit = tab === "upload" ? !!file : !!recordedBlob;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.15)" }}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Video className="h-5 w-5" style={{ color: "#2BFF88" }} /> Novo Clip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab("upload")}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={tab === "upload" ? { background: "#2BFF88", color: "#050708" } : { background: "rgba(43,255,136,0.1)", color: "#9CA3AF" }}
            >
              <Upload className="h-4 w-4 inline mr-1" /> Enviar vídeo
            </button>
            <button
              onClick={() => setTab("record")}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={tab === "record" ? { background: "#2BFF88", color: "#050708" } : { background: "rgba(43,255,136,0.1)", color: "#9CA3AF" }}
            >
              <Circle className="h-4 w-4 inline mr-1" /> Gravar ao vivo
            </button>
          </div>

          {tab === "upload" && (
            <>
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-[#2BFF88]/40"
                style={{ borderColor: file ? "#2BFF88" : "rgba(43,255,136,0.2)", background: "rgba(43,255,136,0.05)" }}
              >
                {file ? (
                  <span className="text-sm text-white">{file.name}</span>
                ) : (
                  <>
                    <Upload className="h-8 w-8" style={{ color: "#2BFF88" }} />
                    <span className="text-sm" style={{ color: "#9CA3AF" }}>Selecionar vídeo (máx 60s)</span>
                  </>
                )}
              </button>
            </>
          )}

          {tab === "record" && (
            <div className="space-y-3">
              <div className="relative w-full aspect-[9/16] max-h-64 rounded-lg overflow-hidden" style={{ background: "#000" }}>
                {!recordedBlob ? (
                  <video ref={videoPreviewRef} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <video src={URL.createObjectURL(recordedBlob)} className="w-full h-full object-cover" controls />
                )}
                {recording && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}>
                    <Circle className="h-2 w-2 fill-current" /> {timer}s / 60s
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {!recording && !recordedBlob && (
                  <Button onClick={startRecording} size="sm" style={{ background: "#ef4444", color: "#fff" }}>
                    <Circle className="h-4 w-4 mr-1 fill-current" /> Gravar
                  </Button>
                )}
                {recording && (
                  <Button onClick={stopRecording} size="sm" style={{ background: "#ef4444", color: "#fff" }}>
                    <Square className="h-4 w-4 mr-1 fill-current" /> Parar
                  </Button>
                )}
                {recordedBlob && (
                  <Button onClick={discardRecording} size="sm" variant="outline" className="border-red-500/30 text-red-400">
                    <Trash2 className="h-4 w-4 mr-1" /> Descartar
                  </Button>
                )}
              </div>
            </div>
          )}

          <div>
            <Label style={{ color: "#9CA3AF" }}>Legenda (opcional)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1" placeholder="Escreva algo..." maxLength={200} />
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit || uploading} className="w-full" style={{ background: "#2BFF88", color: "#050708" }}>
            {uploading ? "Publicando..." : "Publicar Clip"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClipDialog;
