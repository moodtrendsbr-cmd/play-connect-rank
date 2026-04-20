import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { QrCode, UserCheck, UserX, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const ArenaClassEnrollments = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [params, setParams] = useSearchParams();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{ token: string; url: string } | null>(null);

  const classId = params.get("class") || "";

  const loadClasses = async () => {
    if (!arena) return;
    const { data } = await supabase.from("arena_classes")
      .select("id,title,start_at,end_at,capacity")
      .eq("arena_id", arena.id).order("start_at", { ascending: true });
    setClasses(data || []);
    if (!classId && data && data.length > 0) {
      setParams({ class: data[0].id });
    }
  };

  const loadEnrollments = async () => {
    if (!classId) { setEnrollments([]); return; }
    const { data } = await supabase.from("arena_class_enrollments")
      .select("*, arena_students(id,full_name,email)")
      .eq("class_id", classId).order("enrolled_at", { ascending: true });
    setEnrollments(data || []);

    const { data: att } = await supabase.from("arena_attendance")
      .select("*").eq("class_id", classId);
    const map: Record<string, any> = {};
    (att || []).forEach(a => { map[a.student_id] = a; });
    setAttendance(map);
  };

  const loadStudents = async () => {
    if (!arena) return;
    const { data } = await supabase.from("arena_students")
      .select("id,full_name,email").eq("arena_id", arena.id).eq("status", "active");
    setStudents(data || []);
  };

  useEffect(() => { loadClasses(); loadStudents(); }, [arena]);
  useEffect(() => { loadEnrollments(); }, [classId]);

  const currentClass = useMemo(() => classes.find(c => c.id === classId), [classes, classId]);
  const enrolledIds = new Set(enrollments.map(e => e.student_id));
  const available = students.filter(s => !enrolledIds.has(s.id));

  const enroll = async (studentId: string) => {
    const { error } = await supabase.from("arena_class_enrollments").insert({
      arena_id: arena.id, class_id: classId, student_id: studentId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Aluno matriculado");
    loadEnrollments();
  };

  const removeEnrollment = async (id: string) => {
    if (!confirm("Remover matrícula?")) return;
    const { error } = await supabase.from("arena_class_enrollments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    loadEnrollments();
  };

  const togglePresence = async (e: any) => {
    const existing = attendance[e.student_id];
    if (existing) {
      const next = existing.status === "present" ? "absent" : "present";
      const { error } = await supabase.from("arena_attendance").update({
        status: next, checked_in_at: new Date().toISOString(), check_in_method: "manual",
      }).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("arena_attendance").insert({
        arena_id: arena.id, class_id: classId, student_id: e.student_id,
        enrollment_id: e.id, status: "present", check_in_method: "manual",
      });
      if (error) { toast.error(error.message); return; }
    }
    loadEnrollments();
  };

  const generateQR = async () => {
    if (!classId) return;
    const token = crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
    const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await supabase.from("arena_checkin_tokens").insert({
      arena_id: arena.id, class_id: classId, token, expires_at,
    });
    if (error) { toast.error(error.message); return; }
    const url = `${window.location.origin}/arena/checkin?t=${token}`;
    setQrData({ token, url });
    setQrOpen(true);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-foreground">Matrículas</h1>

      <div>
        <label className="text-xs text-muted-foreground">Aula</label>
        <select
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={classId}
          onChange={e => setParams({ class: e.target.value })}
        >
          <option value="">Selecione uma aula</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.title} — {format(new Date(c.start_at), "dd/MM HH:mm")}
            </option>
          ))}
        </select>
      </div>

      {currentClass && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {enrollments.length}/{currentClass.capacity} matriculados
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />Adicionar
            </Button>
            <Button size="sm" onClick={generateQR} className="gap-1.5">
              <QrCode className="h-4 w-4" />QR Check-in
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {classId && enrollments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno matriculado</p>
        )}
        {enrollments.map(e => {
          const present = attendance[e.student_id]?.status === "present";
          return (
            <Card key={e.id} className="bg-card border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.arena_students?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.arena_students?.email || "—"}</p>
                </div>
                {present && <Badge className="text-[10px]">Presente</Badge>}
                <Button size="icon" variant="ghost" onClick={() => togglePresence(e)} title={present ? "Marcar ausente" : "Marcar presente"}>
                  {present ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4 text-primary" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => removeEnrollment(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar aluno</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {available.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Todos os alunos ativos já estão matriculados</p>}
            {available.map(s => (
              <button
                key={s.id}
                onClick={() => { enroll(s.id); setAddOpen(false); }}
                className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium text-foreground">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">{s.email || "—"}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Check-in</DialogTitle></DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={qrData.url} size={220} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Token válido por 30 minutos.<br />Aluno deve estar logado para confirmar presença.</p>
              <code className="text-[10px] text-muted-foreground break-all px-2">{qrData.url}</code>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArenaClassEnrollments;
