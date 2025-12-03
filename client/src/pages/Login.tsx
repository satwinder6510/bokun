import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Lock, Shield, QrCode, Loader2 } from "lucide-react";

type LoginStep = "credentials" | "2fa" | "2fa-setup";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login, setup2FA, verify2FA, verify2FASetup, isAuthenticated } = useAdminAuth();

  if (isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.requiresTwoFactor) {
        setPendingToken(result.pendingToken!);
        setStep("2fa");
        toast({
          title: "Verification Required",
          description: "Enter the 6-digit code from your authenticator app",
        });
      } else if (result.requiresTwoFactorSetup) {
        setPendingToken(result.pendingToken!);
        const setupResult = await setup2FA(result.pendingToken!);
        setQrCode(setupResult.qrCode);
        setSecret(setupResult.secret);
        setStep("2fa-setup");
        toast({
          title: "Set Up Two-Factor Authentication",
          description: "Scan the QR code with your authenticator app",
        });
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await verify2FA(pendingToken!, totpCode);
      toast({
        title: "Welcome Back",
        description: "You have been successfully logged in",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code",
        variant: "destructive",
      });
      setTotpCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await verify2FASetup(pendingToken!, totpCode, secret!);
      toast({
        title: "2FA Setup Complete",
        description: "Your account is now secured with two-factor authentication",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message || "Invalid code",
        variant: "destructive",
      });
      setTotpCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("credentials");
    setTotpCode("");
    setPendingToken(null);
    setQrCode(null);
    setSecret(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {step === "credentials" && <Lock className="w-6 h-6 text-primary" />}
              {step === "2fa" && <Shield className="w-6 h-6 text-primary" />}
              {step === "2fa-setup" && <QrCode className="w-6 h-6 text-primary" />}
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="text-login-title">
            {step === "credentials" && "Admin Login"}
            {step === "2fa" && "Two-Factor Authentication"}
            {step === "2fa-setup" && "Set Up 2FA"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "credentials" && "Sign in with your admin account"}
            {step === "2fa" && "Enter the 6-digit code from your authenticator app"}
            {step === "2fa-setup" && "Scan the QR code with your authenticator app to secure your account"}
          </p>
        </CardHeader>
        <CardContent>
          {step === "credentials" && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  data-testid="input-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !email || !password}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          )}

          {step === "2fa" && (
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">Verification Code</Label>
                <Input
                  id="totp"
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isLoading}
                  autoFocus
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-totp"
                />
              </div>
              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || totpCode.length !== 6}
                  data-testid="button-verify"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Login"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-back"
                >
                  Back to Login
                </Button>
              </div>
            </form>
          )}

          {step === "2fa-setup" && (
            <form onSubmit={handle2FASetupSubmit} className="space-y-4">
              {qrCode && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" data-testid="img-qr-code" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Or enter this code manually:
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all" data-testid="text-secret">
                      {secret}
                    </code>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="setup-totp">Enter Code to Confirm</Label>
                <Input
                  id="setup-totp"
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isLoading}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-setup-totp"
                />
              </div>
              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || totpCode.length !== 6}
                  data-testid="button-complete-setup"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    "Complete Setup & Login"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-cancel-setup"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
