import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Shield } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<"password" | "totp">("password");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simple password check - in production, this would be server-side
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";
    
    if (password === adminPassword) {
      // Password is correct, move to TOTP verification
      setStep("totp");
      toast({
        title: "Password Verified",
        description: "Enter your 6-digit code from authenticator app",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password",
        variant: "destructive",
      });
      setPassword("");
    }
    
    setIsLoading(false);
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await apiRequest("POST", "/api/auth/2fa/verify", {
        token: totpCode,
      }) as { valid: boolean };

      if (result.valid) {
        sessionStorage.setItem("dashboard_auth", "true");
        toast({
          title: "Access Granted",
          description: "Welcome to the dashboard",
        });
        setLocation("/dashboard");
      } else {
        toast({
          title: "Invalid Code",
          description: "The verification code is incorrect",
          variant: "destructive",
        });
        setTotpCode("");
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
      setTotpCode("");
    }

    setIsLoading(false);
  };

  const handleBack = () => {
    setStep("password");
    setTotpCode("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {step === "password" ? (
                <Lock className="w-6 h-6 text-primary" />
              ) : (
                <Shield className="w-6 h-6 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="text-login-title">
            {step === "password" ? "Dashboard Access" : "Two-Factor Authentication"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "password" 
              ? "Enter the admin password to continue"
              : "Enter the 6-digit code from your authenticator app"
            }
          </p>
        </CardHeader>
        <CardContent>
          {step === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  data-testid="input-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !password}
                data-testid="button-login"
              >
                {isLoading ? "Verifying..." : "Continue"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/2fa-setup")}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-setup-2fa"
                >
                  Need to set up 2FA?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div>
                <Input
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
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Open your authenticator app to get the code
                </p>
              </div>
              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || totpCode.length !== 6}
                  data-testid="button-verify"
                >
                  {isLoading ? "Verifying..." : "Verify & Login"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-back"
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
