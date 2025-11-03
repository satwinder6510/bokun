import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type StatusType = "connected" | "disconnected" | "loading" | "error";

interface StatusBadgeProps {
  status: StatusType;
  message?: string;
}

export function StatusBadge({ status, message }: StatusBadgeProps) {
  const configs = {
    connected: {
      icon: CheckCircle2,
      label: message || "Connected",
      className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    },
    disconnected: {
      icon: XCircle,
      label: message || "Disconnected",
      className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    },
    loading: {
      icon: Loader2,
      label: message || "Connecting...",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    },
    error: {
      icon: AlertCircle,
      label: message || "Error",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 px-3 py-1 ${config.className}`} data-testid={`badge-status-${status}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  );
}
