import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ConnectionStatusCard } from "@/components/ConnectionStatusCard";
import { ProductsCard } from "@/components/ProductsCard";
import { JsonViewer } from "@/components/JsonViewer";
import { CredentialsPanel } from "@/components/CredentialsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { AvailabilityChecker } from "@/components/AvailabilityChecker";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiRequest } from "@/lib/queryClient";
import type { ConnectionStatus, BokunProductSearchResponse, BokunProductDetails } from "@shared/schema";
import { Activity, ExternalLink, RefreshCw, Database, LogOut, Star, Phone, Users, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [productsData, setProductsData] = useState<BokunProductSearchResponse | null>(null);
  const { user, logout, isSuperAdmin } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    setLocation("/login");
  };

  const { data: connectionStatus, isLoading: isTestingConnection } = useQuery<ConnectionStatus>({
    queryKey: ["/api/bokun/test-connection"],
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

  // Fetch cache metadata
  const { data: cacheMetadata, refetch: refetchCacheMetadata } = useQuery<{
    lastRefreshAt: string | null;
    totalProducts: number;
  }>({
    queryKey: ["/api/bokun/cache-metadata"],
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
      setProductsData(data);
      queryClient.setQueryData(["/api/bokun/products"], data);
      setLastResponse(data);
      refetchCacheMetadata();
      const fromCache = (data as any).fromCache;
      toast({
        title: fromCache ? "Products Loaded from Cache" : "Products Loaded from API",
        description: `Found ${data.totalHits || 0} products (showing ${data.items?.length || 0})`,
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

  const refreshProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bokun/products/refresh", {});
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Products Refreshed",
        description: `Successfully refreshed ${data.productsRefreshed || 0} products from Bokun API`,
      });
      // Refresh cache metadata
      refetchCacheMetadata();
      // Re-fetch products to show updated data
      fetchProductsMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh products from Bokun API",
        variant: "destructive",
      });
    },
  });

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const handleRefreshProducts = () => {
    refreshProductsMutation.mutate();
  };

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setShowDetailsModal(true);
  };

  const selectedProduct = productsData?.items?.find(p => p.id === selectedProductId);

  // Fetch full product details for rates information
  const { data: productDetails, isLoading: isLoadingProductDetails } = useQuery<BokunProductDetails>({
    queryKey: ["/api/bokun/product", selectedProductId],
    enabled: !!selectedProductId,
  });

  // Auto-load products from cache on mount
  useEffect(() => {
    fetchProductsMutation.mutate();
  }, []);

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
            {user && (
              <span className="text-sm text-muted-foreground" data-testid="text-user-name">
                {user.fullName}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <CredentialsPanel
            accessKey={import.meta.env.BOKUN_ACCESS_KEY || "Not configured"}
            secretKey={import.meta.env.BOKUN_SECRET_KEY || "Not configured"}
          />

          <Card data-testid="card-cache-status">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Product Cache Status</CardTitle>
                    <CardDescription>
                      Products are cached for 30 days to improve performance
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handleRefreshProducts}
                  disabled={refreshProductsMutation.isPending}
                  variant="outline"
                  size="sm"
                  data-testid="button-refresh-products"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshProductsMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshProductsMutation.isPending ? "Refreshing..." : "Refresh Products"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Total Products:</span>
                  <Badge variant="secondary" data-testid="badge-total-products">
                    {cacheMetadata?.totalProducts || 0}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Last Updated:</span>
                  <Badge variant="outline" data-testid="badge-last-updated">
                    {cacheMetadata?.lastRefreshAt
                      ? formatDistanceToNow(new Date(cacheMetadata.lastRefreshAt), { addSuffix: true })
                      : "Never"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-faq-management">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">FAQ Management</CardTitle>
                      <CardDescription>
                        Manage frequently asked questions
                      </CardDescription>
                    </div>
                  </div>
                  <a href="/admin/faq">
                    <Button variant="outline" size="sm" data-testid="button-manage-faqs">
                      Manage FAQs
                    </Button>
                  </a>
                </div>
              </CardHeader>
            </Card>

            <Card data-testid="card-packages-management">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <ExternalLink className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Flight Packages</CardTitle>
                      <CardDescription>
                        Manage flight-inclusive packages
                      </CardDescription>
                    </div>
                  </div>
                  <a href="/admin/packages">
                    <Button variant="outline" size="sm" data-testid="button-manage-packages">
                      Manage Packages
                    </Button>
                  </a>
                </div>
              </CardHeader>
            </Card>

            <Card data-testid="card-reviews-management">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <Star className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Reviews</CardTitle>
                      <CardDescription>
                        Manage customer testimonials
                      </CardDescription>
                    </div>
                  </div>
                  <a href="/admin/reviews">
                    <Button variant="outline" size="sm" data-testid="button-manage-reviews">
                      Manage Reviews
                    </Button>
                  </a>
                </div>
              </CardHeader>
            </Card>

            <Card data-testid="card-tracking-management">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Tracking Numbers</CardTitle>
                      <CardDescription>
                        Dynamic number insertion for calls
                      </CardDescription>
                    </div>
                  </div>
                  <a href="/admin/tracking-numbers">
                    <Button variant="outline" size="sm" data-testid="button-manage-tracking">
                      Manage Numbers
                    </Button>
                  </a>
                </div>
              </CardHeader>
            </Card>

            <Card data-testid="card-flight-pricing-management">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <Plane className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Dynamic Flight Pricing</CardTitle>
                      <CardDescription>
                        Flight + tour package pricing
                      </CardDescription>
                    </div>
                  </div>
                  <Link href="/admin/flight-pricing">
                    <Button variant="outline" size="sm" data-testid="button-manage-flight-pricing">
                      Configure
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>

            {isSuperAdmin() && (
              <Card data-testid="card-users-management">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Admin Users</CardTitle>
                        <CardDescription>
                          Manage admin accounts and permissions
                        </CardDescription>
                      </div>
                    </div>
                    <a href="/admin/users">
                      <Button variant="outline" size="sm" data-testid="button-manage-users">
                        Manage Users
                      </Button>
                    </a>
                  </div>
                </CardHeader>
              </Card>
            )}
          </div>

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
                products={productsData?.items || []}
                totalCount={productsData?.totalHits}
                isLoading={fetchProductsMutation.isPending}
                onProductClick={handleProductClick}
              />
            </div>
          </div>

          {selectedProductId && selectedProduct && productDetails?.rates && (
            <div className="grid grid-cols-1 gap-6" data-testid="availability-section">
              <h2 className="text-xl font-semibold">Check Availability & Pricing</h2>
              <AvailabilityChecker
                productId={selectedProductId}
                productTitle={selectedProduct.title}
                rates={productDetails.rates}
              />
            </div>
          )}

          {lastResponse && (
            <JsonViewer
              data={lastResponse}
              title="Latest API Response"
              timestamp={new Date().toISOString()}
            />
          )}

          <ProductDetailsModal
            productId={selectedProductId}
            open={showDetailsModal}
            onOpenChange={setShowDetailsModal}
          />
        </div>
      </main>

      <footer className="border-t mt-12">
        <div className="container px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex flex-col items-center md:items-start gap-2">
              <p>
                Production API: <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">api.bokun.io</code>
              </p>
              <p className="text-xs">
                💡 To use test environment, set environment variable <code className="font-mono bg-muted px-1 rounded">BOKUN_API_BASE=https://api.bokuntest.com</code>
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
