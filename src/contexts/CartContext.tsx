import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "@/hooks/use-toast";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  companyId: string;
  companyName: string;
}

interface CartData {
  companyId: string;
  companyName: string;
  items: CartItem[];
}

interface CartContextType {
  items: CartItem[];
  companyId: string | null;
  companyName: string | null;
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => boolean;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "mood_cart";

const loadCart = (): CartData | null => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveCart = (data: CartData | null) => {
  if (!data || data.items.length === 0) {
    localStorage.removeItem(CART_KEY);
  } else {
    localStorage.setItem(CART_KEY, JSON.stringify(data));
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartData, setCartData] = useState<CartData | null>(loadCart);

  useEffect(() => {
    saveCart(cartData);
  }, [cartData]);

  const items = cartData?.items || [];
  const companyId = cartData?.companyId || null;
  const companyName = cartData?.companyName || null;

  const addToCart = (item: Omit<CartItem, "quantity">, quantity = 1): boolean => {
    if (cartData && cartData.companyId !== item.companyId) {
      toast({
        title: "Loja diferente",
        description: `Seu carrinho contém produtos de "${cartData.companyName}". Limpe o carrinho para adicionar produtos de outra loja.`,
        variant: "destructive",
      });
      return false;
    }

    setCartData((prev) => {
      const current = prev || { companyId: item.companyId, companyName: item.companyName, items: [] };
      const existing = current.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          ...current,
          items: current.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + quantity } : i
          ),
        };
      }
      return {
        ...current,
        items: [...current.items, { ...item, quantity }],
      };
    });
    return true;
  };

  const removeFromCart = (productId: string) => {
    setCartData((prev) => {
      if (!prev) return null;
      const newItems = prev.items.filter((i) => i.productId !== productId);
      if (newItems.length === 0) return null;
      return { ...prev, items: newItems };
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
      };
    });
  };

  const clearCart = () => setCartData(null);

  const getSubtotal = () => items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const getTotalItems = () => items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, companyId, companyName, addToCart, removeFromCart, updateQuantity, clearCart, getSubtotal, getTotalItems }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType | null => {
  const ctx = useContext(CartContext);
  return ctx ?? null;
};
