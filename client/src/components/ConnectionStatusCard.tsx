import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { ConnectionStatus } from "@shared/schema";

interface ConnectionStatusCardProps {
  status?: ConnectionStatus;
  isLoading: boolean;
  onTest: () => void;
}

export function ConnectionStatusCard({ status, isLoading, onTest }: ConnectionStatusCardProps) {
  const statusType = isLoading
    ? "loading"
    : status?.connected
    ? "connected"
    : status
    ? "error"
    : "disconnected";

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Connection Status
        </CardTitle>
        <StatusBadge status={statusType} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">API Endpoint</span>
            <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {import.meta.env.BOKUN_API_BASE || "api.bokun.com"}
            </code>
          </div>
          
          {status?.responseTime !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Response Time</span>
              <span className="font-medium font-mono text-xs">
                {status.responseTime}ms
              </span>
            </div>
          )}

          {status?.timestamp && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Tested</span>
              <span className="font-mono text-xs">
                {new Date(status.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {status?.message && !status.connected && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-xs text-destructive">{status.message}</p>
          </div>
        )}

        <Button
          onClick={onTest}
          disabled={isLoading}
          className="w-full"
          data-testid="button-test-connection"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Testing Connection...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Test Connection
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
