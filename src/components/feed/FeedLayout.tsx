import { ReactNode } from "react";

interface FeedLayoutProps {
  children: ReactNode;
}

const FeedLayout = ({ children }: FeedLayoutProps) => {
  return (
    <div className="min-h-screen" style={{ background: "#050708" }}>
      {children}
    </div>
  );
};

export default FeedLayout;
