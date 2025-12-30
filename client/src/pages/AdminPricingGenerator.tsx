import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Plus, Trash2, Calendar, Download, 
  Loader2, Plane, RefreshCw, FileSpreadsheet, ArrowRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FlightPackage, PackageSeason } from "@shared/schema";

type SeasonFormData = {
  seasonName: string;
  startDate: string;
  endDate: string;
  landCostPerPerson: number;
  hotelCostPerPerson: number | null;
  notes: string;
};

type OpenJawConfig = {
  ukAirports: string;
  arriveAirport: string;       // Fly into this city
  departAirport: string;       // Fly out from this city (different for open-jaw)
  nights: number;
  searchStartDate: string;
  searchEndDate: string;
  // Internal flight settings
  hasInternalFlight: boolean;
  internalFromAirport: string;
  internalToAirport: string;
  internalDaysAfterArrival: number;
};

type OpenJawPricingRow = {
  outboundDate: string;
  ukDepartureAirport: string;
  ukDepartureAirportName: string;
  outboundArrivalDate: string;
  effectiveArrivalDate: string;
  returnDate: string;
  outboundAirline: string;
  returnAirline: string;
  sameAirline: boolean;
  flightPrice: number;
  internalFlightDate?: string;
  internalFlightPrice?: number;
  landCost: number;
  hotelCost: number;
  totalCost: number;
  seasonName: string;
};

const emptySeasonForm: SeasonFormData = {
  seasonName: "",
  startDate: "",
  endDate: "",
  landCostPerPerson: 0,
  hotelCostPerPerson: null,
  notes: "",
};

const defaultUkAirports = "LHR|LGW|MAN|BHX|STN|LTN|BRS|EDI|GLA";

export default function AdminPricingGenerator() {
  const { toast } = useToast();
  const { sessionToken } = useAdminAuth();
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [seasonFormOpen, setSeasonFormOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<PackageSeason | null>(null);
  const [seasonForm, setSeasonForm] = useState<SeasonFormData>(emptySeasonForm);
  
  const [config, setConfig] = useState<OpenJawConfig>({
    ukAirports: defaultUkAirports,
    arriveAirport: "",
    departAirport: "",
    nights: 10,
    searchStartDate: "",
    searchEndDate: "",
    hasInternalFlight: false,
    internalFromAirport: "",
    internalToAirport: "",
    internalDaysAfterArrival: 3,
  });
  
  const [pricingResults, setPricingResults] = useState<OpenJawPricingRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: packages = [], isLoading: packagesLoading } = useQuery<FlightPackage[]>({
    queryKey: ["/api/admin/packages"],
  });

  const selectedPackage = packages.find(p => p.id === selectedPackageId);

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery<PackageSeason[]>({
    queryKey: ["/api/admin/packages", selectedPackageId, "seasons"],
    enabled: !!selectedPackageId,
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (data: SeasonFormData) => {
      return apiRequest("POST", `/api/admin/packages/${selectedPackageId}/seasons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages", selectedPackageId, "seasons"] });
      setSeasonFormOpen(false);
      setSeasonForm(emptySeasonForm);
      toast({ title: "Season created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating season", description: error.message, variant: "destructive" });
    },
  });

  const updateSeasonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SeasonFormData> }) => {
      return apiRequest("PATCH", `/api/admin/seasons/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages", selectedPackageId, "seasons"] });
      setSeasonFormOpen(false);
      setEditingSeason(null);
      setSeasonForm(emptySeasonForm);
      toast({ title: "Season updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating season", description: error.message, variant: "destructive" });
    },
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/seasons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages", selectedPackageId, "seasons"] });
      toast({ title: "Season deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting season", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenSeasonForm = (season?: PackageSeason) => {
    if (season) {
      setEditingSeason(season);
      setSeasonForm({
        seasonName: season.seasonName,
        startDate: season.startDate,
        endDate: season.endDate,
        landCostPerPerson: season.landCostPerPerson,
        hotelCostPerPerson: season.hotelCostPerPerson,
        notes: season.notes || "",
      });
    } else {
      setEditingSeason(null);
      setSeasonForm(emptySeasonForm);
    }
    setSeasonFormOpen(true);
  };

  const handleSaveSeason = () => {
    if (editingSeason) {
      updateSeasonMutation.mutate({ id: editingSeason.id, data: seasonForm });
    } else {
      createSeasonMutation.mutate(seasonForm);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isOpenJaw = config.arriveAirport !== config.departAirport && config.departAirport !== "";

  const handleGeneratePricing = async () => {
    if (!selectedPackageId || seasons.length === 0) {
      toast({ 
        title: "Cannot generate pricing", 
        description: "Please select a package and add at least one season",
        variant: "destructive" 
      });
      return;
    }

    if (!config.arriveAirport || !config.searchStartDate || !config.searchEndDate) {
      toast({ 
        title: "Missing configuration", 
        description: "Please fill in arrival airport and date range",
        variant: "destructive" 
      });
      return;
    }

    // For open-jaw, departAirport is required
    if (!config.departAirport) {
      toast({ 
        title: "Missing departure airport", 
        description: "Please enter the return departure airport",
        variant: "destructive" 
      });
      return;
    }

    // Validate internal flight configuration if enabled
    if (config.hasInternalFlight) {
      if (!config.internalFromAirport || !config.internalToAirport) {
        toast({ 
          title: "Missing internal flight configuration", 
          description: "Please enter both the departure and arrival airports for the internal flight",
          variant: "destructive" 
        });
        return;
      }
    }

    setIsGenerating(true);
    setPricingResults([]);

    try {
      const requestData: Record<string, unknown> = {
        ukAirports: config.ukAirports.split("|").filter(a => a.trim()),
        arriveAirport: config.arriveAirport,
        departAirport: config.departAirport,
        nights: config.nights,
        searchStartDate: config.searchStartDate,
        searchEndDate: config.searchEndDate,
        hasInternalFlight: config.hasInternalFlight,
        seasons: seasons.map(s => ({
          id: s.id,
          seasonName: s.seasonName,
          startDate: s.startDate,
          endDate: s.endDate,
          landCostPerPerson: s.landCostPerPerson,
          hotelCostPerPerson: s.hotelCostPerPerson,
        })),
      };

      // Only include internal flight fields if the toggle is enabled
      if (config.hasInternalFlight) {
        requestData.internalFromAirport = config.internalFromAirport;
        requestData.internalToAirport = config.internalToAirport;
        requestData.internalDaysAfterArrival = Math.max(0, config.internalDaysAfterArrival);
      }

      const data = await apiRequest("POST", `/api/admin/packages/${selectedPackageId}/generate-openjaw-pricing`, requestData);
      
      if (data.results) {
        setPricingResults(data.results);
        toast({ 
          title: "Pricing generated", 
          description: `${data.results.length} price entries created${data.sameAirlineCount ? ` (${data.sameAirlineCount} same-airline)` : ""}` 
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Error generating pricing", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCsv = () => {
    if (pricingResults.length === 0) return;

    const headers = [
      "Outbound Date",
      "UK Departure",
      "Arrival Date",
      "Effective Arrival",
      "Return Date",
      "Outbound Airline",
      "Return Airline",
      "Same Airline",
      "Flight Price (GBP)",
      ...(config.hasInternalFlight ? ["Internal Date", "Internal Price (GBP)"] : []),
      "Land Cost (GBP)",
      "Hotel Cost (GBP)",
      "Total Cost (GBP)",
      "Season",
      "Selling Price (GBP)"
    ];
    
    const rows = pricingResults.map(row => [
      row.outboundDate,
      row.ukDepartureAirport,
      row.outboundArrivalDate,
      row.effectiveArrivalDate,
      row.returnDate,
      row.outboundAirline,
      row.returnAirline,
      row.sameAirline ? "Yes" : "No",
      row.flightPrice.toFixed(2),
      ...(config.hasInternalFlight ? [
        row.internalFlightDate || "",
        row.internalFlightPrice?.toFixed(2) || "",
      ] : []),
      row.landCost.toFixed(2),
      row.hotelCost.toFixed(2),
      row.totalCost.toFixed(2),
      row.seasonName,
      "", // Selling price to fill in
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openjaw_pricing_${selectedPackage?.slug || "package"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please log in to access the admin panel</p>
            <div className="mt-4 text-center">
              <Link href="/admin/login">
                <Button>Go to Login</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/packages">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Open-Jaw Pricing Generator</h1>
            <p className="text-muted-foreground">
              Generate pricing for open-jaw flights (fly into one city, out of another)
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Package & Seasons */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5" />
                  Select Package
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedPackageId?.toString() || ""}
                  onValueChange={(value) => setSelectedPackageId(parseInt(value))}
                >
                  <SelectTrigger data-testid="select-package">
                    <SelectValue placeholder="Choose a package..." />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id.toString()}>
                        {pkg.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPackage && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="font-medium">{selectedPackage.title}</p>
                    <p className="text-sm text-muted-foreground">{selectedPackage.category}</p>
                    <p className="text-sm text-muted-foreground">{selectedPackage.duration}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Seasons & Land Costs
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleOpenSeasonForm()}
                    disabled={!selectedPackageId}
                    data-testid="button-add-season"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </CardTitle>
                <CardDescription>
                  Define seasonal land costs per person
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedPackageId ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select a package first
                  </p>
                ) : seasonsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : seasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No seasons defined. Add seasons with land costs.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {seasons.map((season) => (
                      <div
                        key={season.id}
                        className="p-3 border rounded-lg flex items-start justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{season.seasonName}</p>
                          <p className="text-xs text-muted-foreground">
                            {season.startDate} to {season.endDate}
                          </p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary">
                              Land: {formatCurrency(season.landCostPerPerson)}
                            </Badge>
                            {season.hotelCostPerPerson && (
                              <Badge variant="outline">
                                Hotel: {formatCurrency(season.hotelCostPerPerson)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenSeasonForm(season)}
                            data-testid={`button-edit-season-${season.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-season-${season.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Season</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{season.seasonName}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSeasonMutation.mutate(season.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Flight Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Open-Jaw Flight Configuration</CardTitle>
                <CardDescription>
                  Configure the open-jaw route: fly into one city, return from another
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Route Configuration */}
                <div className="p-4 border rounded-lg bg-muted/30">
                  <Label className="text-base font-semibold mb-3 block">Flight Route</Label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-muted-foreground">UK Airports</Label>
                      <Input
                        placeholder="LHR|MAN|BHX"
                        value={config.ukAirports}
                        onChange={(e) => setConfig({ ...config, ukAirports: e.target.value.toUpperCase() })}
                        data-testid="input-uk-airports"
                      />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground mt-4" />
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground">Fly Into</Label>
                      <Input
                        placeholder="DEL"
                        value={config.arriveAirport}
                        onChange={(e) => setConfig({ ...config, arriveAirport: e.target.value.toUpperCase() })}
                        data-testid="input-arrive-airport"
                      />
                    </div>
                    <span className="text-muted-foreground mt-4">...</span>
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground">Fly Out</Label>
                      <Input
                        placeholder="BOM"
                        value={config.departAirport}
                        onChange={(e) => setConfig({ ...config, departAirport: e.target.value.toUpperCase() })}
                        data-testid="input-depart-airport"
                      />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground mt-4" />
                    <div className="mt-4">
                      <Badge variant={isOpenJaw ? "default" : "secondary"}>
                        {isOpenJaw ? "Open-Jaw" : "Round Trip"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Example: LHR → DEL (Delhi), then BOM (Mumbai) → LHR
                  </p>
                </div>

                {/* Duration & Date Range */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Duration (nights)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={config.nights}
                      onChange={(e) => setConfig({ ...config, nights: parseInt(e.target.value) || 7 })}
                      data-testid="input-nights"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Return = effective arrival + nights
                    </p>
                  </div>
                  <div>
                    <Label>Search Start Date</Label>
                    <Input
                      type="date"
                      value={config.searchStartDate}
                      onChange={(e) => setConfig({ ...config, searchStartDate: e.target.value })}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label>Search End Date</Label>
                    <Input
                      type="date"
                      value={config.searchEndDate}
                      onChange={(e) => setConfig({ ...config, searchEndDate: e.target.value })}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <Separator />

                {/* Internal Flight Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Internal Flight</Label>
                      <p className="text-sm text-muted-foreground">
                        Add a domestic flight within the destination country
                      </p>
                    </div>
                    <Switch
                      checked={config.hasInternalFlight}
                      onCheckedChange={(checked) => setConfig({ ...config, hasInternalFlight: checked })}
                      data-testid="switch-internal-flight"
                    />
                  </div>

                  {config.hasInternalFlight && (
                    <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-24">
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <Input
                            placeholder="DEL"
                            value={config.internalFromAirport}
                            onChange={(e) => setConfig({ ...config, internalFromAirport: e.target.value.toUpperCase() })}
                            data-testid="input-internal-from"
                          />
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground mt-4" />
                        <div className="w-24">
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <Input
                            placeholder="JAI"
                            value={config.internalToAirport}
                            onChange={(e) => setConfig({ ...config, internalToAirport: e.target.value.toUpperCase() })}
                            data-testid="input-internal-to"
                          />
                        </div>
                        <div className="w-32">
                          <Label className="text-xs text-muted-foreground">Days After Arrival</Label>
                          <Input
                            type="number"
                            min={0}
                            value={config.internalDaysAfterArrival}
                            onChange={(e) => setConfig({ ...config, internalDaysAfterArrival: parseInt(e.target.value) || 0 })}
                            data-testid="input-internal-days"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Internal flight date = effective arrival date + {config.internalDaysAfterArrival} days
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Generate Button */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleGeneratePricing}
                    disabled={isGenerating || !selectedPackageId || seasons.length === 0}
                    className="flex-1"
                    data-testid="button-generate"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating (this may take a few minutes)...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Generate Open-Jaw Pricing
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleDownloadCsv}
                    disabled={pricingResults.length === 0}
                    data-testid="button-download-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Table */}
            {pricingResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span>Generated Pricing ({pricingResults.length} rows)</span>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{selectedPackage?.title}</Badge>
                      <Badge variant="outline">
                        {pricingResults.filter(r => r.sameAirline).length} same-airline
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Outbound</TableHead>
                          <TableHead>UK Airport</TableHead>
                          <TableHead>Arrival</TableHead>
                          <TableHead>Return</TableHead>
                          <TableHead>Airlines</TableHead>
                          <TableHead className="text-right">Flight</TableHead>
                          {config.hasInternalFlight && (
                            <TableHead className="text-right">Internal</TableHead>
                          )}
                          <TableHead className="text-right">Land</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Season</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricingResults.slice(0, 100).map((row, idx) => (
                          <TableRow key={idx} className={row.sameAirline ? "" : "opacity-60"}>
                            <TableCell>{row.outboundDate}</TableCell>
                            <TableCell>{row.ukDepartureAirport}</TableCell>
                            <TableCell>
                              <span title={`Actual: ${row.outboundArrivalDate}`}>
                                {row.effectiveArrivalDate}
                              </span>
                            </TableCell>
                            <TableCell>{row.returnDate}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{row.outboundAirline}</span>
                                {row.sameAirline ? (
                                  <Badge variant="default" className="text-[10px] px-1">Same</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">/ {row.returnAirline}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(row.flightPrice)}</TableCell>
                            {config.hasInternalFlight && (
                              <TableCell className="text-right">
                                {row.internalFlightPrice ? formatCurrency(row.internalFlightPrice) : "-"}
                              </TableCell>
                            )}
                            <TableCell className="text-right">{formatCurrency(row.landCost)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.totalCost)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{row.seasonName}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {pricingResults.length > 100 && (
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Showing first 100 of {pricingResults.length} rows. Download CSV for full data.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Season Form Dialog */}
      <Dialog open={seasonFormOpen} onOpenChange={setSeasonFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSeason ? "Edit Season" : "Add Season"}</DialogTitle>
            <DialogDescription>
              Define a season with its date range and land cost per person
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Season Name</Label>
              <Input
                placeholder="e.g., Peak Season, Low Season"
                value={seasonForm.seasonName}
                onChange={(e) => setSeasonForm({ ...seasonForm, seasonName: e.target.value })}
                data-testid="input-season-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={seasonForm.startDate}
                  onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                  data-testid="input-season-start"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={seasonForm.endDate}
                  onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                  data-testid="input-season-end"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Land Cost per Person (GBP)</Label>
                <Input
                  type="number"
                  min={0}
                  value={seasonForm.landCostPerPerson}
                  onChange={(e) => setSeasonForm({ ...seasonForm, landCostPerPerson: parseFloat(e.target.value) || 0 })}
                  data-testid="input-land-cost"
                />
              </div>
              <div>
                <Label>Hotel Cost per Person (Optional)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Leave empty if included"
                  value={seasonForm.hotelCostPerPerson ?? ""}
                  onChange={(e) => setSeasonForm({ 
                    ...seasonForm, 
                    hotelCostPerPerson: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  data-testid="input-hotel-cost"
                />
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input
                placeholder="Any notes about this season"
                value={seasonForm.notes}
                onChange={(e) => setSeasonForm({ ...seasonForm, notes: e.target.value })}
                data-testid="input-season-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSeasonFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSeason}
              disabled={createSeasonMutation.isPending || updateSeasonMutation.isPending}
              data-testid="button-save-season"
            >
              {(createSeasonMutation.isPending || updateSeasonMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingSeason ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
