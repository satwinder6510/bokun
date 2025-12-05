import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Settings, Save, Loader2, RefreshCw, DollarSign } from "lucide-react";
import type { SiteSetting } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [exchangeRate, setExchangeRate] = useState("0.79");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings = [], isLoading, refetch } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");
    if (rateSetting) {
      setExchangeRate(rateSetting.value);
      setHasChanges(false);
    }
  }, [settings]);

  const initializeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/settings/initialize", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Settings initialized successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to initialize settings", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (value: string) => apiRequest("PUT", "/api/admin/settings/usd_to_gbp_rate", { 
      value,
      label: "USD to GBP Exchange Rate",
      description: "Exchange rate used to convert Bokun API prices from USD to GBP"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rate"] });
      setHasChanges(false);
      toast({ title: "Exchange rate updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update exchange rate", description: error.message, variant: "destructive" });
    },
  });

  const handleRateChange = (value: string) => {
    setExchangeRate(value);
    const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");
    setHasChanges(value !== (rateSetting?.value || "0.79"));
  };

  const handleSave = () => {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0 || rate > 2) {
      toast({ 
        title: "Invalid exchange rate", 
        description: "Please enter a valid rate between 0.01 and 2.00",
        variant: "destructive" 
      });
      return;
    }
    updateMutation.mutate(exchangeRate);
  };

  const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Site Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card data-testid="card-exchange-rate">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Currency Conversion</CardTitle>
                  <CardDescription>
                    Set the exchange rate for converting Bokun API prices from USD to GBP
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !rateSetting ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">
                    Exchange rate setting not found. Click below to initialize default settings.
                  </p>
                  <Button 
                    onClick={() => initializeMutation.mutate()}
                    disabled={initializeMutation.isPending}
                    data-testid="button-initialize-settings"
                  >
                    {initializeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Initialize Settings
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="exchange-rate">USD to GBP Exchange Rate</Label>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm font-medium">1 USD =</span>
                        <Input
                          id="exchange-rate"
                          type="number"
                          step="0.001"
                          min="0.01"
                          max="2.00"
                          value={exchangeRate}
                          onChange={(e) => handleRateChange(e.target.value)}
                          className="w-32"
                          data-testid="input-exchange-rate"
                        />
                        <span className="text-muted-foreground text-sm font-medium">GBP</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This rate is applied to all Bokun tour prices before the 10% markup
                      </p>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <h4 className="text-sm font-medium">Price Calculation Example</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Bokun Price: $100 USD</p>
                        <p>After Conversion: £{(100 * parseFloat(exchangeRate || "0")).toFixed(2)} GBP</p>
                        <p>After 10% Markup: <span className="text-foreground font-medium">£{(100 * parseFloat(exchangeRate || "0") * 1.10).toFixed(2)} GBP</span></p>
                      </div>
                    </div>

                    {rateSetting.updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last updated: {new Date(rateSetting.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      onClick={handleSave}
                      disabled={updateMutation.isPending || !hasChanges}
                      data-testid="button-save-settings"
                    >
                      {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => refetch()}
                      disabled={isLoading}
                      data-testid="button-refresh-settings"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>Bokun API returns tour prices in <strong>USD</strong></li>
                <li>The exchange rate you set here converts USD prices to <strong>GBP</strong></li>
                <li>A <strong>10% markup</strong> is then applied to the converted price</li>
                <li>The final price is displayed to customers on the website</li>
              </ol>
              <p className="mt-4">
                <strong>Tip:</strong> Check current USD/GBP rates and set this slightly above 
                market rate to cover currency fluctuations and payment processing fees.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
