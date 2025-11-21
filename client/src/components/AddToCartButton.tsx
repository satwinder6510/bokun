import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";

interface AddToCartButtonProps {
  productId: string;
  productTitle: string;
  productPrice: number;
  date?: string;
  rateId?: number;
  rateTitle?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function AddToCartButton({
  productId,
  productTitle,
  productPrice,
  date,
  rateId,
  rateTitle,
  variant = "default",
  size = "default",
  className,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const { selectedCurrency } = useCurrency();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsAdding(true);
    try {
      await addToCart({
        productId,
        productTitle,
        productPrice,
        currency: selectedCurrency.code,
        date,
        rateId,
        rateTitle,
        quantity: 1,
      });
      
      setJustAdded(true);
      toast({
        title: "Added to cart",
        description: `${productTitle} has been added to your cart.`,
      });
      
      setTimeout(() => setJustAdded(false), 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add to cart",
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleAddToCart}
      disabled={isAdding || justAdded}
      className={className}
      data-testid={`button-add-to-cart-${productId}`}
    >
      {justAdded ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Added
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4 mr-2" />
          {isAdding ? "Adding..." : "Add to Cart"}
        </>
      )}
    </Button>
  );
}
