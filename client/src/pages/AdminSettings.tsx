import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Settings, Save, Loader2, RefreshCw, DollarSign, Home, Image, Package } from "lucide-react";
import type { SiteSetting } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [exchangeRate, setExchangeRate] = useState("0.79");
  const [carouselSlides, setCarouselSlides] = useState("3");
  const [packagesCount, setPackagesCount] = useState("3");
  const [carouselInterval, setCarouselInterval] = useState("6");
  const [hasChanges, setHasChanges] = useState(false);
  const [hasHomepageChanges, setHasHomepageChanges] = useState(false);

  const { data: settings = [], isLoading, refetch } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");
    if (rateSetting) {
      setExchangeRate(rateSetting.value);
      setHasChanges(false);
    }
    
    const slidesSetting = settings.find(s => s.key === "homepage_carousel_slides");
    if (slidesSetting) {
      setCarouselSlides(slidesSetting.value);
    }
    
    const packagesSetting = settings.find(s => s.key === "homepage_packages_count");
    if (packagesSetting) {
      setPackagesCount(packagesSetting.value);
    }
    
    const intervalSetting = settings.find(s => s.key === "homepage_carousel_interval");
    if (intervalSetting) {
      setCarouselInterval(intervalSetting.value);
    }
    
    setHasHomepageChanges(false);
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

  const updateHomepageSettingsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/admin/settings/homepage_carousel_slides", {
        value: carouselSlides,
        label: "Homepage Carousel Slides",
        description: "Number of slides to show in the homepage carousel"
      });
      await apiRequest("PUT", "/api/admin/settings/homepage_packages_count", {
        value: packagesCount,
        label: "Homepage Packages Count",
        description: "Number of flight packages to display on homepage"
      });
      await apiRequest("PUT", "/api/admin/settings/homepage_carousel_interval", {
        value: carouselInterval,
        label: "Homepage Carousel Interval",
        description: "Auto-rotation interval in seconds"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-settings"] });
      setHasHomepageChanges(false);
      toast({ title: "Homepage settings updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update homepage settings", description: error.message, variant: "destructive" });
    },
  });

  const handleRateChange = (value: string) => {
    setExchangeRate(value);
    const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");
    setHasChanges(value !== (rateSetting?.value || "0.79"));
  };

  const handleHomepageChange = (setter: (val: string) => void, key: string) => (value: string) => {
    setter(value);
    const setting = settings.find(s => s.key === key);
    const defaultValues: Record<string, string> = {
      homepage_carousel_slides: "3",
      homepage_packages_count: "3",
      homepage_carousel_interval: "6"
    };
    setHasHomepageChanges(true);
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

  const handleSaveHomepage = () => {
    const slides = parseInt(carouselSlides);
    const packages = parseInt(packagesCount);
    const interval = parseInt(carouselInterval);
    
    if (isNaN(slides) || slides < 1 || slides > 10) {
      toast({ title: "Invalid carousel slides", description: "Please enter a number between 1 and 10", variant: "destructive" });
      return;
    }
    if (isNaN(packages) || packages < 1 || packages > 24) {
      toast({ title: "Invalid packages count", description: "Please enter a number between 1 and 24", variant: "destructive" });
      return;
    }
    if (isNaN(interval) || interval < 3 || interval > 30) {
      toast({ title: "Invalid carousel interval", description: "Please enter a number between 3 and 30 seconds", variant: "destructive" });
      return;
    }
    
    updateHomepageSettingsMutation.mutate();
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
          {/* Homepage Display Settings */}
          <Card data-testid="card-homepage-settings">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Homepage Display</CardTitle>
                  <CardDescription>
                    Control what appears on your homepage
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                {/* Carousel Slides */}
                <div className="space-y-2">
                  <Label htmlFor="carousel-slides" className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    Hero Carousel Slides
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="carousel-slides"
                      type="number"
                      min="1"
                      max="10"
                      value={carouselSlides}
                      onChange={(e) => handleHomepageChange(setCarouselSlides, "homepage_carousel_slides")(e.target.value)}
                      className="w-24"
                      data-testid="input-carousel-slides"
                    />
                    <span className="text-sm text-muted-foreground">slides (1-10)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Number of slides in the hero carousel. Uses your flight packages first, then fills with Bokun tours.
                  </p>
                </div>

                {/* Packages Count */}
                <div className="space-y-2">
                  <Label htmlFor="packages-count" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Flight Packages to Display
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="packages-count"
                      type="number"
                      min="1"
                      max="24"
                      value={packagesCount}
                      onChange={(e) => handleHomepageChange(setPackagesCount, "homepage_packages_count")(e.target.value)}
                      className="w-24"
                      data-testid="input-packages-count"
                    />
                    <span className="text-sm text-muted-foreground">packages (1-24)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Number of flight packages shown in the "Flight Packages" section on homepage.
                  </p>
                </div>

                {/* Carousel Interval */}
                <div className="space-y-2">
                  <Label htmlFor="carousel-interval">Carousel Auto-Rotation</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="carousel-interval"
                      type="number"
                      min="3"
                      max="30"
                      value={carouselInterval}
                      onChange={(e) => handleHomepageChange(setCarouselInterval, "homepage_carousel_interval")(e.target.value)}
                      className="w-24"
                      data-testid="input-carousel-interval"
                    />
                    <span className="text-sm text-muted-foreground">seconds (3-30)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How often the carousel automatically advances to the next slide.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t">
                <Button
                  onClick={handleSaveHomepage}
                  disabled={updateHomepageSettingsMutation.isPending || !hasHomepageChanges}
                  data-testid="button-save-homepage-settings"
                >
                  {updateHomepageSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Homepage Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Currency Conversion */}
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
