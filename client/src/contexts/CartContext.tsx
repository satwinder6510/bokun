import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CartItem {
  id: number;
  sessionId: string;
  productId: string;
  productTitle: string;
  productPrice: number;
  currency: string;
  quantity: number;
  productData: any;
  createdAt: string;
}

interface CartContextType {
  sessionId: string;
  items: CartItem[];
  itemCount: number;
  isLoading: boolean;
  addToCart: (product: any) => Promise<void>;
  removeFromCart: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem("sessionId");
    if (stored) return stored;
    
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("sessionId", newId);
    return newId;
  });

  const queryClient = useQueryClient();

  const { data: cartData, isLoading } = useQuery({
    queryKey: ["/api/cart", sessionId],
    queryFn: async () => {
      const response = await fetch("/api/cart", {
        headers: { "x-session-id": sessionId },
      });
      if (!response.ok) throw new Error("Failed to fetch cart");
      return response.json();
    },
  });

  const { data: countData } = useQuery({
    queryKey: ["/api/cart/count", sessionId],
    queryFn: async () => {
      const response = await fetch("/api/cart/count", {
        headers: { "x-session-id": sessionId },
      });
      if (!response.ok) throw new Error("Failed to fetch cart count");
      return response.json();
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async (product: any) => {
      const response = await apiRequest("POST", "/api/cart", {
        productId: product.id,
        productTitle: product.title,
        productPrice: product.price || 0,
        currency: product.currency || "USD",
        quantity: 1,
        productData: product,
      }, { "x-session-id": sessionId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/count", sessionId] });
    },
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await apiRequest("DELETE", `/api/cart/${itemId}`, undefined, {
        "x-session-id": sessionId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/count", sessionId] });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/cart", undefined, {
        "x-session-id": sessionId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart/count", sessionId] });
    },
  });

  return (
    <CartContext.Provider
      value={{
        sessionId,
        items: cartData?.items || [],
        itemCount: countData?.count || 0,
        isLoading,
        addToCart: addToCartMutation.mutateAsync,
        removeFromCart: removeFromCartMutation.mutateAsync,
        clearCart: clearCartMutation.mutateAsync,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
