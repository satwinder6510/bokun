import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Settings, Save, Loader2, RefreshCw, DollarSign, Home, Image, Package, Upload, X, Plane, Database } from "lucide-react";
import type { SiteSetting } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const { sessionToken } = useAdminAuth();
  const [exchangeRate, setExchangeRate] = useState("0.79");
  const [packagesCount, setPackagesCount] = useState("4");
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasHomepageChanges, setHasHomepageChanges] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isRefreshingFlights, setIsRefreshingFlights] = useState(false);
  const [isRefreshingBokun, setIsRefreshingBokun] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings = [], isLoading, refetch } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");
    if (rateSetting) {
      setExchangeRate(rateSetting.value);
      setHasChanges(false);
    }
    
    const packagesSetting = settings.find(s => s.key === "homepage_packages_count");
    if (packagesSetting) {
      setPackagesCount(packagesSetting.value);
    }
    
    const heroImageSetting = settings.find(s => s.key === "homepage_hero_image");
    if (heroImageSetting) {
      setHeroImage(heroImageSetting.value);
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
      await apiRequest("PUT", "/api/admin/settings/homepage_packages_count", {
        value: packagesCount,
        label: "Homepage Packages Count",
        description: "Number of flight packages to display on homepage"
      });
      if (heroImage !== null) {
        await apiRequest("PUT", "/api/admin/settings/homepage_hero_image", {
          value: heroImage,
          label: "Homepage Hero Image",
          description: "Background image for the homepage hero section"
        });
      }
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

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setHeroImage(data.url);
      setHasHomepageChanges(true);
      toast({ title: "Hero image uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploadingHero(false);
      if (heroFileInputRef.current) {
        heroFileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveHeroImage = async () => {
    setHeroImage(null);
    // Save empty value to remove the hero image
    try {
      await apiRequest("PUT", "/api/admin/settings/homepage_hero_image", {
        value: "",
        label: "Homepage Hero Image",
        description: "Background image for the homepage hero section"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-settings"] });
      toast({ title: "Hero image removed" });
    } catch (error) {
      toast({ title: "Failed to remove hero image", variant: "destructive" });
    }
  };

  const handleRateChange = (value: string) => {
    setExchangeRate(value);
    const rateSetting = settings.find(s => s.key === "usd_to_gbp_rate");
    setHasChanges(value !== (rateSetting?.value || "0.79"));
  };

  const handleHomepageChange = (setter: (val: string) => void) => (value: string) => {
    setter(value);
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
    const packages = parseInt(packagesCount);
    
    if (isNaN(packages) || packages < 1 || packages > 24) {
      toast({ title: "Invalid packages count", description: "Please enter a number between 1 and 24", variant: "destructive" });
      return;
    }
    
    updateHomepageSettingsMutation.mutate();
  };

  const handleRefreshFlightPrices = async () => {
    setIsRefreshingFlights(true);
    try {
      const response = await fetch("/api/admin/refresh-flight-prices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-session": sessionToken || ""
        },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start refresh");
      }
      toast({ 
        title: "Flight price refresh started", 
        description: "This may take several minutes. Check server logs for progress." 
      });
    } catch (error: any) {
      toast({ 
        title: "Failed to start flight refresh", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsRefreshingFlights(false);
    }
  };

  const handleRefreshBokunCache = async () => {
    setIsRefreshingBokun(true);
    try {
      const response = await fetch("/api/admin/refresh-bokun-cache", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-session": sessionToken || ""
        },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start refresh");
      }
      toast({ 
        title: "Bokun cache refresh started", 
        description: "This may take several minutes." 
      });
    } catch (error: any) {
      toast({ 
        title: "Failed to start Bokun refresh", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsRefreshingBokun(false);
    }
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
                {/* Hero Image */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    Hero Background Image
                  </Label>
                  
                  {heroImage ? (
                    <div className="relative rounded-lg overflow-hidden border">
                      <img 
                        src={heroImage} 
                        alt="Hero background" 
                        className="w-full h-40 object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveHeroImage}
                        data-testid="button-remove-hero-image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => heroFileInputRef.current?.click()}
                    >
                      {isUploadingHero ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to upload hero image</span>
                          <span className="text-xs text-muted-foreground">Recommended: 1920x1080px or larger</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleHeroImageUpload}
                    data-testid="input-hero-image"
                  />
                  
                  <p className="text-xs text-muted-foreground">
                    This image appears as the hero banner background on your homepage. If not set, it will use an image from your packages.
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
                      onChange={(e) => handleHomepageChange(setPackagesCount)(e.target.value)}
                      className="w-24"
                      data-testid="input-packages-count"
                    />
                    <span className="text-sm text-muted-foreground">packages (1-24)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Number of flight packages shown in the "Flight Packages" section on homepage.
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                System Actions
              </CardTitle>
              <CardDescription>
                Manually trigger scheduled tasks. These normally run automatically on Sundays.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="w-5 h-5 text-blue-600" />
                    <h4 className="font-medium">Flight Price Refresh</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Updates flight prices for all packages using the Bokun Departures + Flights module. Scheduled: Sundays 3:00 AM UK.
                  </p>
                  <Button 
                    onClick={handleRefreshFlightPrices}
                    disabled={isRefreshingFlights}
                    variant="outline"
                    className="w-full"
                    data-testid="button-refresh-flights"
                  >
                    {isRefreshingFlights ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plane className="w-4 h-4 mr-2" />
                    )}
                    {isRefreshingFlights ? "Starting..." : "Refresh Flight Prices"}
                  </Button>
                </div>

                <div className="flex-1 p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-green-600" />
                    <h4 className="font-medium">Bokun Product Cache</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Refreshes the cached list of Bokun tours displayed on the website. Scheduled: Sundays 8:00 PM UK.
                  </p>
                  <Button 
                    onClick={handleRefreshBokunCache}
                    disabled={isRefreshingBokun}
                    variant="outline"
                    className="w-full"
                    data-testid="button-refresh-bokun"
                  >
                    {isRefreshingBokun ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 mr-2" />
                    )}
                    {isRefreshingBokun ? "Starting..." : "Refresh Bokun Cache"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
