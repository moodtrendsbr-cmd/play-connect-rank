import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUserRound, Plus, LogOut, Check, Trash2, LayoutDashboard, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

interface SavedAccount {
  email: string;
  full_name: string;
  avatar_url: string | null;
  user_id: string;
  pwd?: string;
}

const STORAGE_KEY = "mood_saved_accounts";

const getSavedAccounts = (): SavedAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveAccounts = (accounts: SavedAccount[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
};

const ProfileSwitcher = () => {
  const { user, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[]>(getSavedAccounts());
  const [currentProfile, setCurrentProfile] = useState<SavedAccount | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Save current user to accounts list
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, user_id")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const current: SavedAccount = {
          email: user.email || "",
          full_name: data.full_name || "",
          avatar_url: data.avatar_url,
          user_id: data.user_id,
        };
        setCurrentProfile(current);

        // Auto-save current account (preserve pwd if already stored)
        const existing = getSavedAccounts();
        const existingAccount = existing.find((a) => a.user_id === user.id);
        const currentWithPwd: SavedAccount = { ...current, pwd: existingAccount?.pwd };
        
        if (!existingAccount) {
          const updated = [...existing, currentWithPwd];
          saveAccounts(updated);
          setAccounts(updated);
        } else {
          const updated = existing.map((a) =>
            a.user_id === user.id ? { ...currentWithPwd, pwd: a.pwd } : a
          );
          saveAccounts(updated);
          setAccounts(updated);
        }
      }
    };
    fetchProfile();
  }, [user]);

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.user_id === user?.id) {
      setOpen(false);
      navigate("/profile");
      return;
    }
    // Auto-switch if we have stored credentials
    if (account.pwd) {
      setLoading(true);
      try {
        await signOut();
        const { error } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: account.pwd,
        });
        if (error) throw error;
        toast({ title: "Conta alternada!" });
        setOpen(false);
        navigate("/feed");
      } catch (err: any) {
        // If auto-login fails, fall back to manual form
        setLoginEmail(account.email);
        setLoginPassword("");
        setShowAddForm(true);
        toast({ title: "Sessão expirada", description: "Digite a senha novamente.", variant: "destructive" });
      }
      setLoading(false);
      return;
    }
    // Fallback: show login form
    setLoginEmail(account.email);
    setLoginPassword("");
    setShowAddForm(true);
  };

  const handleAddAccount = () => {
    setLoginEmail("");
    setLoginPassword("");
    setShowAddForm(true);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return;
    setLoading(true);
    try {
      await signOut();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      // Save credentials for future auto-switch
      if (authData.user) {
        const existing = getSavedAccounts();
        const updated = existing.map((a) =>
          a.email === loginEmail ? { ...a, pwd: loginPassword } : a
        );
        // If not found, it'll be auto-added by useEffect with pwd missing,
        // so also set a temp store
        const found = updated.some((a) => a.email === loginEmail);
        if (!found) {
          updated.push({ email: loginEmail, full_name: "", avatar_url: null, user_id: authData.user.id, pwd: loginPassword });
        }
        saveAccounts(updated);
        setAccounts(updated);
      }
      toast({ title: "Conta alternada!" });
      setShowAddForm(false);
      setOpen(false);
      navigate("/feed");
    } catch (err: any) {
      toast({
        title: "Erro ao entrar",
        description: err.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleRemoveAccount = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId === user?.id) return; // Can't remove current
    const updated = accounts.filter((a) => a.user_id !== userId);
    saveAccounts(updated);
    setAccounts(updated);
    toast({ title: "Conta removida da lista" });
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const otherAccounts = accounts.filter((a) => a.user_id !== user?.id);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowAddForm(false); }}>
      <PopoverTrigger asChild>
        <button className="p-2 relative">
          {currentProfile?.avatar_url ? (
            <img
              src={currentProfile.avatar_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover border"
              style={{ borderColor: "rgba(43,255,136,0.3)" }}
            />
          ) : (
            <CircleUserRound className="h-5 w-5" style={{ color: "#9CA3AF" }} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.15)" }}
      >
        {!showAddForm ? (
          <div>
            {/* Current Account */}
            {currentProfile && (
              <button
                onClick={() => { setOpen(false); navigate("/profile"); }}
                className="flex items-center gap-3 w-full p-3 hover:bg-white/5 transition-colors"
              >
                {currentProfile.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border" style={{ borderColor: "rgba(43,255,136,0.3)" }} />
                ) : (
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
                    {getInitials(currentProfile.full_name || "A")}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white truncate">{currentProfile.full_name}</p>
                  <p className="text-[11px] truncate" style={{ color: "#9CA3AF" }}>{currentProfile.email}</p>
                </div>
                <Check className="h-4 w-4 shrink-0" style={{ color: "#2BFF88" }} />
              </button>
            )}

            {/* Divider */}
            {otherAccounts.length > 0 && (
              <div className="border-t" style={{ borderColor: "rgba(43,255,136,0.1)" }}>
                <p className="text-[10px] font-semibold uppercase px-3 pt-2 pb-1" style={{ color: "#9CA3AF" }}>
                  Contas salvas
                </p>
                {otherAccounts.map((account) => (
                  <button
                    key={account.user_id}
                    onClick={() => handleSwitchAccount(account)}
                    className="flex items-center gap-3 w-full px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    {account.avatar_url ? (
                      <img src={account.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,255,255,0.1)", color: "#9CA3AF" }}>
                        {getInitials(account.full_name || "A")}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-sm text-white truncate">{account.full_name}</p>
                      <p className="text-[11px] truncate" style={{ color: "#9CA3AF" }}>{account.email}</p>
                    </div>
                    <button
                      onClick={(e) => handleRemoveAccount(account.user_id, e)}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="border-t" style={{ borderColor: "rgba(43,255,136,0.1)" }}>
              {(userRole === "organizer" || userRole === "admin") && (
                <button
                  onClick={() => { setOpen(false); navigate("/dashboard"); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(43,255,136,0.1)" }}>
                    <LayoutDashboard className="h-4 w-4" style={{ color: "#2BFF88" }} />
                  </div>
                  <span className="text-sm" style={{ color: "#2BFF88" }}>Dashboard</span>
                </button>
              )}
              {userRole === "admin" && (
                <button
                  onClick={() => { setOpen(false); navigate("/admin"); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(43,255,136,0.1)" }}>
                    <Shield className="h-4 w-4" style={{ color: "#2BFF88" }} />
                  </div>
                  <span className="text-sm" style={{ color: "#2BFF88" }}>Painel Admin</span>
                </button>
              )}
              <button
                onClick={handleAddAccount}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(43,255,136,0.1)" }}>
                  <Plus className="h-4 w-4" style={{ color: "#2BFF88" }} />
                </div>
                <span className="text-sm" style={{ color: "#2BFF88" }}>Adicionar conta</span>
              </button>
              <button
                onClick={async () => { await signOut(); setOpen(false); navigate("/login"); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <LogOut className="h-4 w-4" style={{ color: "#9CA3AF" }} />
                </div>
                <span className="text-sm" style={{ color: "#9CA3AF" }}>Sair</span>
              </button>
            </div>
          </div>
        ) : (
          /* Login Form */
          <div className="p-4 space-y-3">
            <p className="text-sm font-semibold text-white">
              {loginEmail ? "Entrar na conta" : "Adicionar conta"}
            </p>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-transparent text-white outline-none"
              style={{ borderColor: "rgba(43,255,136,0.2)" }}
            />
            <input
              type="password"
              placeholder="Senha"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-transparent text-white outline-none"
              style={{ borderColor: "rgba(43,255,136,0.2)" }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="flex-1 rounded-md py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: "#2BFF88", color: "#050708" }}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 rounded-md py-2 text-sm transition-colors"
                style={{ color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ProfileSwitcher;
