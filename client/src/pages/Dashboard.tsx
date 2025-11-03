import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConnectionStatusCard } from "@/components/ConnectionStatusCard";
import { ProductsCard } from "@/components/ProductsCard";
import { JsonViewer } from "@/components/JsonViewer";
import { CredentialsPanel } from "@/components/CredentialsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiRequest } from "@/lib/queryClient";
import type { ConnectionStatus, BokunProductSearchResponse } from "@shared/schema";
import { Activity, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lastResponse, setLastResponse] = useState<any>(null);

  const { data: connectionStatus, isLoading: isTestingConnection } = useQuery<ConnectionStatus>({
    queryKey: ["/api/bokun/test-connection"],
    enabled: false,
  });

  const { data: productsData, isLoading: isFetchingProducts } = useQuery<BokunProductSearchResponse>({
    queryKey: ["/api/bokun/products"],
    enabled: false,
  });

  const testConnectionMutation = useMutation<ConnectionStatus>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bokun/test-connection", {});
      return response as ConnectionStatus;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/bokun/test-connection"], data);
      setLastResponse(data);
      if (data.connected) {
        toast({
          title: "Connection Successful",
          description: `Connected to Bokun API in ${data.responseTime}ms`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const errorResponse = {
        error: true,
        message: error.message || "Failed to test connection",
        timestamp: new Date().toISOString(),
      };
      setLastResponse(errorResponse);
      toast({
        title: "Connection Error",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  const fetchProductsMutation = useMutation<BokunProductSearchResponse>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bokun/products", {
        page: 1,
        pageSize: 20,
      });
      return response as BokunProductSearchResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/bokun/products"], data);
      setLastResponse(data);
      toast({
        title: "Products Loaded",
        description: `Found ${data.totalCount || 0} products`,
      });
    },
    onError: (error: any) => {
      const errorResponse = {
        error: true,
        message: error.message || "Failed to fetch products",
        timestamp: new Date().toISOString(),
      };
      setLastResponse(errorResponse);
      toast({
        title: "Failed to Fetch Products",
        description: error.message || "Could not retrieve products from Bokun API",
        variant: "destructive",
      });
    },
  });

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const handleFetchProducts = () => {
    fetchProductsMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Bokun API Testing Console
              </h1>
              <p className="text-sm text-muted-foreground">
                Verify connectivity and explore available products
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              data-testid="link-documentation"
            >
              <a
                href="https://bokun.dev/booking-api-rest/vU6sCfxwYdJWd1QAcLt12i"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                API Docs
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <CredentialsPanel
            accessKey={import.meta.env.BOKUN_ACCESS_KEY || "Not configured"}
            secretKey={import.meta.env.BOKUN_SECRET_KEY || "Not configured"}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <ConnectionStatusCard
                status={connectionStatus}
                isLoading={testConnectionMutation.isPending}
                onTest={handleTestConnection}
              />
            </div>

            <div className="lg:col-span-2">
              <ProductsCard
                products={productsData?.results || []}
                totalCount={productsData?.totalCount}
                isLoading={fetchProductsMutation.isPending}
                onFetch={handleFetchProducts}
              />
            </div>
          </div>

          {lastResponse && (
            <JsonViewer
              data={lastResponse}
              title="Latest API Response"
              timestamp={new Date().toISOString()}
            />
          )}
        </div>
      </main>

      <footer className="border-t mt-12">
        <div className="container px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex flex-col items-center md:items-start gap-2">
              <p>
                API Endpoint: <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{import.meta.env.BOKUN_API_BASE || "api.bokun.com"}</code>
              </p>
              <p className="text-xs">
                💡 If you see "Invalid API key" errors, your credentials may be for a different environment. 
                Set <code className="font-mono bg-muted px-1 rounded">BOKUN_API_BASE</code> to switch between production and test.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://docs.bokun.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Support Resources
              </a>
              <span className="text-xs">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
