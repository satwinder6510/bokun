import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, Copy, CheckCheck, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface JsonViewerProps {
  data: any;
  title?: string;
  statusCode?: number;
  timestamp?: string;
}

export function JsonViewer({ data, title = "API Response", statusCode, timestamp }: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "JSON response has been copied successfully.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  if (!data) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-json"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {statusCode && (
            <Badge
              variant={statusCode < 300 ? "default" : "destructive"}
              className="font-mono text-xs"
            >
              {statusCode}
            </Badge>
          )}
          {timestamp && (
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            disabled={copied}
            data-testid="button-copy-json"
          >
            {copied ? (
              <CheckCheck className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <pre className="p-4 text-xs font-mono leading-relaxed">
              <code className="language-json">
                {JSON.stringify(data, null, 2)}
              </code>
            </pre>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
