import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShoppingCart, Trash2, CreditCard, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { apiRequest } from "@/lib/queryClient";

interface CheckoutFormProps {
  serverAmount: number;
  serverCurrency: string;
  paymentIntentId: string;
}

function CheckoutForm({ serverAmount, serverCurrency, paymentIntentId }: CheckoutFormProps) {
  const [, navigate] = useLocation();
  const { items, clearCart } = useCart();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Use server-validated amount and currency (secure)
  const subtotal = serverAmount;
  const currency = serverCurrency;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast({
        variant: "destructive",
        title: "Payment system not ready",
        description: "Please wait a moment and try again.",
      });
      return;
    }

    // Validate form data
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all fields.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm payment with Stripe
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking-confirmation`,
          receipt_email: formData.email,
        },
        redirect: "if_required",
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Payment confirmed! Now create booking on backend with verification
      try {
        const bookingResponse = await apiRequest("POST", "/api/bookings", {
          customerFirstName: formData.firstName,
          customerLastName: formData.lastName,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          stripePaymentIntentId: paymentIntentId,
          // Backend derives all amounts from Payment Intent - no client values sent
        });
        
        const bookingData = await bookingResponse.json();
        
        if (!bookingData.booking) {
          throw new Error("Failed to create booking record");
        }

        // Clear cart after successful booking creation
        await clearCart();

        // Navigate to confirmation page with booking reference
        toast({
          title: "Payment successful!",
          description: `Booking confirmed: ${bookingData.booking.bookingReference}`,
        });
        
        navigate(`/booking-confirmation?ref=${bookingData.booking.bookingReference}`);
      } catch (bookingError: any) {
        console.error("Booking creation error:", bookingError);
        toast({
          variant: "destructive",
          title: "Payment processed but booking failed",
          description: "Your payment was successful but we couldn't create your booking. Please contact support with payment ID: " + paymentIntentId,
        });
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        variant: "destructive",
        title: "Payment failed",
        description: error.message || "Failed to process payment. Please try again.",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Your Details</h2>
              <div className="space-y-4">
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
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Payment Details</h2>
              </div>
              <PaymentElement 
                options={{
                  layout: "tabs",
                }}
              />
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>Secure payment powered by Stripe</span>
              </div>
            </Card>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isProcessing || !stripe || !elements}
              data-testid="button-submit-booking"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Pay {formatCurrency(subtotal, currency)}
                </>
              )}
            </Button>
          </div>

          <Card className="p-6 h-fit">
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
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatCurrency(item.productPrice, item.currency)}
                    </p>
                  </div>
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
        </form>
      </div>
    </div>
  );
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, itemCount, removeFromCart } = useCart();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string>("");
  const [stripePublishableKey, setStripePublishableKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [serverValidatedAmount, setServerValidatedAmount] = useState<number>(0);
  const [serverValidatedCurrency, setServerValidatedCurrency] = useState<string>("");
  const [paymentIntentId, setPaymentIntentId] = useState<string>("");

  // productPrice already includes quantity calculation (per-person price × number of people)
  const clientSubtotal = items.reduce((sum, item) => sum + item.productPrice, 0);
  const currency = items[0]?.currency || 'USD';

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

  // Fetch Stripe config and create payment intent
  useEffect(() => {
    const initializeStripe = async () => {
      try {
        setIsLoading(true);

        // Get Stripe publishable key
        const configResponse = await fetch("/api/stripe/config");
        const { publishableKey } = await configResponse.json();
        setStripePublishableKey(publishableKey);

        // Create payment intent - backend calculates amount from cart (secure)
        const paymentResponse = await apiRequest("POST", "/api/create-payment-intent", {});
        const data = await paymentResponse.json();
        
        if (data.clientSecret && data.amount !== undefined && data.currency && data.paymentIntentId) {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId);
          setServerValidatedAmount(data.amount);
          setServerValidatedCurrency(data.currency);
          
          // Defensive check: warn if client and server totals mismatch
          if (Math.abs(data.amount - clientSubtotal) > 0.01) {
            console.error("AMOUNT MISMATCH:", { 
              clientCalculated: clientSubtotal, 
              serverValidated: data.amount 
            });
            toast({
              variant: "destructive",
              title: "Cart total mismatch",
              description: "Please refresh the page. Your cart may be out of sync.",
            });
            throw new Error("Cart total mismatch");
          }
        } else {
          throw new Error("Failed to create payment intent");
        }
      } catch (error: any) {
        console.error("Error initializing Stripe:", error);
        toast({
          variant: "destructive",
          title: "Payment setup failed",
          description: error.message || "Failed to initialize payment system. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (itemCount > 0) {
      initializeStripe();
    }
  }, [itemCount, clientSubtotal, currency, toast]);

  if (isLoading || !clientSecret || !stripePublishableKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Preparing checkout...</p>
        </div>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#E74C3C',
      },
    },
  };

  const stripePromiseWithKey = loadStripe(stripePublishableKey);

  return (
    <Elements stripe={stripePromiseWithKey} options={options}>
      <CheckoutForm 
        serverAmount={serverValidatedAmount}
        serverCurrency={serverValidatedCurrency}
        paymentIntentId={paymentIntentId}
      />
    </Elements>
  );
}
