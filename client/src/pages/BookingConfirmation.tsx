import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function BookingConfirmation() {
  const [, params] = useRoute("/booking/:reference");
  const reference = params?.reference || "";

  return (
    <div className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <div className="mb-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">Thank you for your booking</p>
        </div>

        <Card className="p-8 text-left">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Booking Reference</p>
              <p className="text-xl font-semibold" data-testid="text-booking-reference">{reference}</p>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                A confirmation email has been sent to your email address with all the booking details.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-8">
          <Button asChild data-testid="button-back-home">
            <a href="/">Back to Homepage</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
