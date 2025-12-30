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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Trash2, Calendar, Download, Upload, 
  Loader2, Plane, RefreshCw, FileSpreadsheet
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

type GeneratorConfig = {
  flightApi: "european" | "serp";
  departAirports: string;
  arriveAirportCode: string;
  durationNights: number;
  searchStartDate: string;
  searchEndDate: string;
};

type PricingRow = {
  date: string;
  departureAirport: string;
  departureAirportName: string;
  flightPrice: number;
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

const defaultAirports = "LGW|STN|LTN|LHR|MAN|BHX|BRS|EDI|GLA";

export default function AdminPricingGenerator() {
  const { toast } = useToast();
  const { sessionToken } = useAdminAuth();
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [seasonFormOpen, setSeasonFormOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<PackageSeason | null>(null);
  const [seasonForm, setSeasonForm] = useState<SeasonFormData>(emptySeasonForm);
  const [generatorConfig, setGeneratorConfig] = useState<GeneratorConfig>({
    flightApi: "serp",
    departAirports: defaultAirports,
    arriveAirportCode: "",
    durationNights: 7,
    searchStartDate: "",
    searchEndDate: "",
  });
  const [pricingResults, setPricingResults] = useState<PricingRow[]>([]);
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

  const handleGeneratePricing = async () => {
    if (!selectedPackageId || seasons.length === 0) {
      toast({ 
        title: "Cannot generate pricing", 
        description: "Please select a package and add at least one season",
        variant: "destructive" 
      });
      return;
    }

    if (!generatorConfig.arriveAirportCode || !generatorConfig.searchStartDate || !generatorConfig.searchEndDate) {
      toast({ 
        title: "Missing configuration", 
        description: "Please fill in destination airport and date range",
        variant: "destructive" 
      });
      return;
    }

    setIsGenerating(true);
    setPricingResults([]);

    try {
      const response = await apiRequest("POST", `/api/admin/packages/${selectedPackageId}/generate-pricing`, {
        ...generatorConfig,
        seasons: seasons.map(s => ({
          id: s.id,
          seasonName: s.seasonName,
          startDate: s.startDate,
          endDate: s.endDate,
          landCostPerPerson: s.landCostPerPerson,
          hotelCostPerPerson: s.hotelCostPerPerson,
        })),
      });

      const data = await response.json();
      
      if (data.results) {
        setPricingResults(data.results);
        toast({ title: "Pricing generated", description: `${data.results.length} price entries created` });
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

    const headers = ["Date", "Departure Airport", "Airport Name", "Flight Price (GBP)", "Land Cost (GBP)", "Hotel Cost (GBP)", "Total Cost (GBP)", "Season", "Selling Price (GBP)"];
    const rows = pricingResults.map(row => [
      row.date,
      row.departureAirport,
      row.departureAirportName,
      row.flightPrice.toFixed(2),
      row.landCost.toFixed(2),
      row.hotelCost.toFixed(2),
      row.totalCost.toFixed(2),
      row.seasonName,
      "", // Empty column for selling price to be filled in
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing_${selectedPackage?.slug || "package"}_${new Date().toISOString().split("T")[0]}.csv`;
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
            <h1 className="text-3xl font-bold">Pricing Generator</h1>
            <p className="text-muted-foreground">Generate pricing CSV with flight + land costs</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
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
                          <div className="flex gap-2 mt-1">
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

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Flight Configuration</CardTitle>
                <CardDescription>Configure flight search parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Flight API</Label>
                    <Select
                      value={generatorConfig.flightApi}
                      onValueChange={(value: "european" | "serp") => 
                        setGeneratorConfig({ ...generatorConfig, flightApi: value })
                      }
                    >
                      <SelectTrigger data-testid="select-flight-api">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="european">European API (Sunshine)</SelectItem>
                        <SelectItem value="serp">SERP API (Google Flights)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Destination Airport Code</Label>
                    <Input
                      placeholder="e.g., DEL, BKK, DXB"
                      value={generatorConfig.arriveAirportCode}
                      onChange={(e) => 
                        setGeneratorConfig({ ...generatorConfig, arriveAirportCode: e.target.value.toUpperCase() })
                      }
                      data-testid="input-destination-airport"
                    />
                  </div>
                </div>

                <div>
                  <Label>Departure Airports (pipe-separated)</Label>
                  <Input
                    placeholder="LGW|STN|LTN|LHR|MAN"
                    value={generatorConfig.departAirports}
                    onChange={(e) => 
                      setGeneratorConfig({ ...generatorConfig, departAirports: e.target.value.toUpperCase() })
                    }
                    data-testid="input-departure-airports"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Common UK airports: LGW, STN, LTN, LHR, MAN, BHX, BRS, EDI, GLA
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Duration (nights)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={generatorConfig.durationNights}
                      onChange={(e) => 
                        setGeneratorConfig({ ...generatorConfig, durationNights: parseInt(e.target.value) || 7 })
                      }
                      data-testid="input-duration"
                    />
                  </div>

                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={generatorConfig.searchStartDate}
                      onChange={(e) => 
                        setGeneratorConfig({ ...generatorConfig, searchStartDate: e.target.value })
                      }
                      data-testid="input-start-date"
                    />
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={generatorConfig.searchEndDate}
                      onChange={(e) => 
                        setGeneratorConfig({ ...generatorConfig, searchEndDate: e.target.value })
                      }
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <Separator />

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
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Generate Pricing
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

            {pricingResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Generated Pricing ({pricingResults.length} rows)</span>
                    <Badge variant="secondary">{selectedPackage?.title}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Airport</TableHead>
                          <TableHead className="text-right">Flight</TableHead>
                          <TableHead className="text-right">Land</TableHead>
                          <TableHead className="text-right">Hotel</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Season</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricingResults.slice(0, 50).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row.date}</TableCell>
                            <TableCell>{row.departureAirport}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.flightPrice)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.landCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.hotelCost)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.totalCost)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.seasonName}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {pricingResults.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Showing first 50 of {pricingResults.length} rows. Download CSV for full data.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

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
                placeholder="e.g., Peak Season, Low Season, Season 1"
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
                  placeholder="Leave empty if included in land cost"
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
              {(createSeasonMutation.isPending || updateSeasonMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingSeason ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
