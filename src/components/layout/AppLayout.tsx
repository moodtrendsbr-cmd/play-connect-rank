import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FeedBottomNav from "@/components/feed/FeedBottomNav";
import CreatePostDialog from "@/components/feed/CreatePostDialog";
import CartButton from "@/components/marketplace/CartButton";

// Map of legacy paths → canonical /athlete/* paths.
// Athletes get redirected so they always live inside AthleteShell with a single nav.
const ATHLETE_REDIRECTS: Record<string, string> = {
  "/feed": "/athlete/feed",
  "/profile": "/athlete/perfil",
  "/ranking": "/athlete/ranking",
  "/messages": "/athlete/mensagens",
  "/tournaments": "/athlete/torneios",
};

const AppLayout = () => {
  const { user, userRole } = useAuth();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  if (user && userRole === "athlete") {
    const target = ATHLETE_REDIRECTS[location.pathname];
    if (target) return <Navigate to={target} replace />;
  }

  const handleRefresh = () => {};

  return (
    <div className="min-h-screen" style={{ background: "#050708" }}>
      <Outlet />
      <CartButton />
      <FeedBottomNav onCreatePost={() => setCreateOpen(true)} />
      {user && (
        <CreatePostDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          userId={user.id}
          onCreated={handleRefresh}
        />
      )}
    </div>
  );
};

export default AppLayout;
