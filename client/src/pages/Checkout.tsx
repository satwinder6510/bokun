import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, removeFromCart, itemCount } = useCart();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Redirect if cart is empty
  useEffect(() => {
    if (itemCount === 0) {
      toast({
        title: "Empty cart",
        description: "Your cart is empty. Please add tours before checking out.",
      });
      navigate("/");
    }
  }, [itemCount, navigate, toast]);

  const subtotal = items.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
  const currency = items[0]?.currency || 'USD';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      toast({
        title: "Booking system coming soon",
        description: "Full checkout with Stripe payment integration is currently in development.",
      });
      
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process booking",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  data-testid="input-first-name"
                />
              </div>
              
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  data-testid="input-last-name"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="input-email"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="input-phone"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isProcessing}
                data-testid="button-submit-booking"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Complete Booking"
                )}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingCart className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Booking Summary</h2>
            </div>
            
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-start gap-4 pb-4 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium line-clamp-2 mb-1" data-testid={`text-checkout-item-${item.id}`}>
                      {item.productTitle}
                    </h3>
                    {item.date && (
                      <p className="text-sm text-muted-foreground">
                        Date: {new Date(item.date).toLocaleDateString()}
                      </p>
                    )}
                    {item.rateTitle && (
                      <p className="text-sm text-muted-foreground">{item.rateTitle}</p>
                    )}
                    <p className="text-sm font-semibold mt-1">
                      {formatCurrency(item.productPrice, item.currency)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromCart(item.id)}
                    data-testid={`button-remove-checkout-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <div className="space-y-2">
              <div className="flex justify-between text-base">
                <span>Subtotal</span>
                <span data-testid="text-subtotal">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span data-testid="text-total">{formatCurrency(subtotal, currency)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
