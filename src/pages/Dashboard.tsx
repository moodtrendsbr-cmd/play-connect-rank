import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveLandingPath } from "@/lib/loginDispatch";

/**
 * Legacy /dashboard route — now a pure dispatcher.
 * Sends the user to their role-appropriate landing.
 */
const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    resolveLandingPath(user.id)
      .then((dest) => navigate(dest, { replace: true }))
      .catch(() => {
        setError("Não foi possível carregar seu painel. Tente novamente.");
      });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
};

export default Dashboard;
