import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Shield, ArrowLeft, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TwoFactorSetup() {
  const [, setLocation] = useLocation();

  const { data: setupData, isLoading } = useQuery<{
    secret: string;
    qrCode: string;
    uri: string;
  }>({
    queryKey: ["/api/auth/2fa/setup"],
  });

  const handleContinue = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="text-setup-title">
            Two-Factor Authentication Setup
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Secure your dashboard with authenticator app
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Generating QR code...
            </div>
          ) : setupData ? (
            <>
              <Alert>
                <AlertDescription>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg border-2">
                    <img 
                      src={setupData.qrCode} 
                      alt="2FA QR Code" 
                      className="w-64 h-64"
                      data-testid="img-qr-code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-center">
                    Can't scan the QR code?
                  </p>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-xs text-muted-foreground mb-2">
                      Manual entry code:
                    </p>
                    <code className="text-sm font-mono break-all" data-testid="text-secret">
                      {setupData.secret}
                    </code>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Download an authenticator app if you don't have one (Google Authenticator, Authy, 1Password, etc.)
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Scan the QR code above or enter the manual code
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      You'll need to enter a 6-digit code from your app each time you log in
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="gap-2"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Button>
                <Button
                  onClick={handleContinue}
                  className="flex-1 gap-2"
                  data-testid="button-continue"
                >
                  I've Scanned the Code
                  <Shield className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-destructive">
              Failed to generate QR code
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
