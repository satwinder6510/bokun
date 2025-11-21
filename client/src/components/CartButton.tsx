import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export function CartButton() {
  const { items, itemCount, removeFromCart } = useCart();
  const [, navigate] = useLocation();
  const { formatCurrency } = useCurrency();

  // productPrice already includes quantity calculation (per-person price × number of people)
  const total = items.reduce((sum, item) => sum + item.productPrice, 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-cart"
        >
          <ShoppingCart className="w-5 h-5" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold" data-testid="text-cart-count">
              {itemCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Shopping Cart ({itemCount})</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Your cart is empty</p>
          ) : (
            <>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {items.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-cart-item-${item.id}`}>
                          {item.productTitle}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatCurrency(item.productPrice, item.currency)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => removeFromCart(item.id)}
                        data-testid={`button-remove-${item.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              
              <div className="border-t pt-4 space-y-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span data-testid="text-cart-total">
                    {formatCurrency(total, items[0]?.currency || 'USD')}
                  </span>
                </div>
                
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/checkout')}
                  data-testid="button-checkout"
                >
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
