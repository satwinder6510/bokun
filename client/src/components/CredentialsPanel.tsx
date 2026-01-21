import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CredentialsPanelProps {
  accessKey: string;
  secretKey: string;
}

export function CredentialsPanel({ accessKey, secretKey }: CredentialsPanelProps) {
  const [showAccess, setShowAccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const maskKey = (key: string, visible: boolean) => {
    if (visible) return key;
    if (key.length <= 8) return "•".repeat(key.length);
    return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          API Credentials
        </CardTitle>
        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          <Key className="h-3 w-3 mr-1" />
          Configured
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Access Key
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setShowAccess(!showAccess)}
                data-testid="button-toggle-access-key"
              >
                {showAccess ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <div className="font-mono text-xs bg-muted px-3 py-2 rounded-md border">
              {maskKey(accessKey, showAccess)}
            </div>
            <p className="text-xs text-muted-foreground">
              From environment variable
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Secret Key
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setShowSecret(!showSecret)}
                data-testid="button-toggle-secret-key"
              >
                {showSecret ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <div className="font-mono text-xs bg-muted px-3 py-2 rounded-md border">
              {maskKey(secretKey, showSecret)}
            </div>
            <p className="text-xs text-muted-foreground">
              Securely stored in Replit Secrets
            </p>
          </div>
        </div>

        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Secure:</strong> Credentials are loaded from environment variables and never exposed in client-side code.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
