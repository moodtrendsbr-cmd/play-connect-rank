import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FeedBottomNav from "@/components/feed/FeedBottomNav";
import CreatePostDialog from "@/components/feed/CreatePostDialog";
import CartButton from "@/components/marketplace/CartButton";

const AppLayout = () => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

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
