import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate, useLocation } from "react-router-dom";

const CartButton = () => {
  const { getTotalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const count = getTotalItems();

  if (count === 0) return null;
  if (location.pathname === "/marketplace/cart" || location.pathname === "/marketplace/checkout") return null;

  return (
    <button
      onClick={() => navigate("/marketplace/cart")}
      className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
      style={{ background: "#2BFF88" }}
    >
      <ShoppingCart className="h-6 w-6" style={{ color: "#050708" }} />
      <span
        className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center"
        style={{ background: "#050708", color: "#2BFF88", border: "2px solid #2BFF88" }}
      >
        {count}
      </span>
    </button>
  );
};

export default CartButton;
