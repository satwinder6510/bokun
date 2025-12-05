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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Plus, Trash2, Edit2, Plane, Save, X, 
  Calendar, Search, ExternalLink, Loader2, Settings2, MapPin, Check
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
import type { FlightTourPricingConfig, InsertFlightTourPricingConfig } from "@shared/schema";

type AirportOption = {
  code: string;
  name: string;
};

type FormData = {
  bokunProductId: string;
  arriveAirportCode: string;
  departAirports: string;
  durationNights: number;
  searchStartDate: string;
  searchEndDate: string;
  markupPercent: number;
  isEnabled: boolean;
};

type BokunProduct = {
  id: string;
  title: string;
  excerpt?: string;
  price: number;
  locationCode?: {
    country?: string;
    location?: string;
    name?: string;
  };
  durationText?: string;
  keyPhoto?: {
    originalUrl?: string;
    derived?: Array<{ url: string }>;
  };
};

const emptyForm: FormData = {
  bokunProductId: "",
  arriveAirportCode: "",
  departAirports: "LGW|STN|LTN|LHR|MAN|BHX|BRS|EDI|GLA",
  durationNights: 7,
  searchStartDate: "",
  searchEndDate: "",
  markupPercent: 15,
  isEnabled: true,
};

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day}`;
}

function formatDateForApi(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export default function AdminFlightPricing() {
  const { toast } = useToast();
  const { sessionToken } = useAdminAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FlightTourPricingConfig | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  
  const [tourSearchQuery, setTourSearchQuery] = useState("");
  const [tourSearchOpen, setTourSearchOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<BokunProduct | null>(null);
  const tourSearchRef = useRef<HTMLDivElement>(null);

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (sessionToken) {
      headers['x-admin-session'] = sessionToken;
    }
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tourSearchRef.current && !tourSearchRef.current.contains(event.target as Node)) {
        setTourSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: airports = [] } = useQuery<AirportOption[]>({
    queryKey: ["/api/flight-pricing/airports"],
  });

  const { data: configs = [], isLoading } = useQuery<FlightTourPricingConfig[]>({
    queryKey: ["/api/admin/flight-pricing-configs"],
    queryFn: () => adminFetch("/api/admin/flight-pricing-configs"),
    enabled: !!sessionToken,
  });

  const { data: toursData, isLoading: isLoadingTours } = useQuery<{ items: BokunProduct[] }>({
    queryKey: ["/api/bokun/products", "tour-search"],
    queryFn: async () => {
      // Always fetch USD prices from Bokun - conversion to GBP happens on frontend
      const response = await apiRequest("POST", "/api/bokun/products", { 
        page: 1, 
        pageSize: 100
      });
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredTours = (toursData?.items || []).filter(tour => {
    if (!tourSearchQuery.trim()) return true;
    const query = tourSearchQuery.toLowerCase();
    return (
      tour.title?.toLowerCase().includes(query) ||
      tour.id?.toLowerCase().includes(query) ||
      tour.locationCode?.name?.toLowerCase().includes(query) ||
      tour.locationCode?.country?.toLowerCase().includes(query)
    );
  }).slice(0, 20);

  const handleSelectTour = (tour: BokunProduct) => {
    setSelectedTour(tour);
    setFormData({ ...formData, bokunProductId: tour.id });
    setTourSearchOpen(false);
    setTourSearchQuery("");
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertFlightTourPricingConfig) => {
      return await adminFetch("/api/admin/flight-pricing-configs", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flight-pricing-configs"] });
      toast({ title: "Success", description: "Flight pricing config created" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create config", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertFlightTourPricingConfig> }) => {
      return await adminFetch(`/api/admin/flight-pricing-configs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flight-pricing-configs"] });
      toast({ title: "Success", description: "Flight pricing config updated" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update config", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await adminFetch(`/api/admin/flight-pricing-configs/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flight-pricing-configs"] });
      toast({ title: "Success", description: "Config deleted" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete config", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setIsCreating(false);
    setEditingConfig(null);
    setSelectedTour(null);
    setTourSearchQuery("");
  };

  const handleEdit = (config: FlightTourPricingConfig) => {
    setEditingConfig(config);
    setFormData({
      bokunProductId: config.bokunProductId,
      arriveAirportCode: config.arriveAirportCode,
      departAirports: config.departAirports,
      durationNights: config.durationNights,
      searchStartDate: config.searchStartDate,
      searchEndDate: config.searchEndDate,
      markupPercent: config.markupPercent,
      isEnabled: config.isEnabled,
    });
  };

  const handleSubmit = () => {
    const payload: InsertFlightTourPricingConfig = {
      bokunProductId: formData.bokunProductId.trim(),
      arriveAirportCode: formData.arriveAirportCode.toUpperCase().trim(),
      departAirports: formData.departAirports,
      durationNights: formData.durationNights,
      searchStartDate: formData.searchStartDate,
      searchEndDate: formData.searchEndDate,
      markupPercent: formData.markupPercent,
      isEnabled: formData.isEnabled,
    };

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleTestFlightApi = async () => {
    setIsTestingApi(true);
    setTestResults(null);
    
    try {
      const response = await adminFetch(
        `/api/admin/flight-pricing-configs/test-search?depart=${formData.departAirports}&arrive=${formData.arriveAirportCode}&nights=${formData.durationNights}&startDate=${formData.searchStartDate}&endDate=${formData.searchEndDate}`
      );
      setTestResults(response);
    } catch (error: any) {
      setTestResults({ error: error.message || "Failed to test flight API" });
    } finally {
      setIsTestingApi(false);
    }
  };

  const filteredConfigs = configs.filter(config =>
    config.bokunProductId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.arriveAirportCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isFormOpen = isCreating || editingConfig !== null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                <Plane className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Dynamic Flight Pricing</h1>
                <p className="text-sm text-muted-foreground">
                  Configure flight + tour package pricing
                </p>
              </div>
            </div>
          </div>
          <Button onClick={() => setIsCreating(true)} className="gap-2" data-testid="button-add-config">
            <Plus className="h-4 w-4" />
            Add Configuration
          </Button>
        </div>
      </header>

      <main className="container px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {!isFormOpen ? (
            <>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Bokun ID or airport code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <Badge variant="secondary">
                  {filteredConfigs.length} config{filteredConfigs.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConfigs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No Configurations</h3>
                    <p className="text-muted-foreground mt-2">
                      Add a configuration to enable dynamic flight + tour pricing for Bokun tours.
                    </p>
                    <Button onClick={() => setIsCreating(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Add First Configuration
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bokun Product ID</TableHead>
                        <TableHead>Arrival Airport</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Markup</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConfigs.map((config) => (
                        <TableRow key={config.id} data-testid={`row-config-${config.id}`}>
                          <TableCell className="font-mono text-sm">
                            <a
                              href={`/tour/${config.bokunProductId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              {config.bokunProductId}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{config.arriveAirportCode}</Badge>
                          </TableCell>
                          <TableCell>{config.durationNights} nights</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {config.searchStartDate} - {config.searchEndDate}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{config.markupPercent}%</Badge>
                          </TableCell>
                          <TableCell>
                            {config.isEnabled ? (
                              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(config)}
                                data-testid={`button-edit-${config.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`button-delete-${config.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Configuration?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove the flight pricing config for Bokun product {config.bokunProductId}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(config.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{editingConfig ? "Edit Configuration" : "New Configuration"}</CardTitle>
                <CardDescription>
                  Configure flight API parameters and pricing markup for a Bokun tour.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Select Bokun Tour *</Label>
                    {editingConfig ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                        <Badge variant="outline" className="font-mono">{formData.bokunProductId}</Badge>
                        <span className="text-sm text-muted-foreground">(Cannot change tour when editing)</span>
                      </div>
                    ) : selectedTour ? (
                      <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Check className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="font-medium text-sm">{selectedTour.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="font-mono text-xs">{selectedTour.id}</Badge>
                              {selectedTour.locationCode?.name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {selectedTour.locationCode.name}
                                </span>
                              )}
                              {selectedTour.durationText && <span>{selectedTour.durationText}</span>}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTour(null);
                            setFormData({ ...formData, bokunProductId: "" });
                          }}
                          data-testid="button-clear-tour"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div ref={tourSearchRef} className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search tours by name, location, or ID..."
                            value={tourSearchQuery}
                            onChange={(e) => {
                              setTourSearchQuery(e.target.value);
                              setTourSearchOpen(true);
                            }}
                            onFocus={() => setTourSearchOpen(true)}
                            className="pl-10"
                            data-testid="input-tour-search"
                          />
                          {isLoadingTours && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        {tourSearchOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                            <ScrollArea className="max-h-80">
                              {filteredTours.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  {isLoadingTours ? "Loading tours..." : "No tours found"}
                                </div>
                              ) : (
                                <div className="p-1">
                                  {filteredTours.map((tour) => (
                                    <button
                                      key={tour.id}
                                      type="button"
                                      className="w-full text-left p-3 rounded-md hover-elevate cursor-pointer flex items-start gap-3"
                                      onClick={() => handleSelectTour(tour)}
                                      data-testid={`tour-option-${tour.id}`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{tour.title}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                          <Badge variant="outline" className="font-mono text-xs">{tour.id}</Badge>
                                          {tour.locationCode?.name && (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <MapPin className="h-3 w-3" />
                                              {tour.locationCode.name}, {tour.locationCode.country}
                                            </span>
                                          )}
                                          {tour.durationText && (
                                            <span className="text-xs text-muted-foreground">{tour.durationText}</span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-sm font-medium text-primary">
                                        £{tour.price?.toFixed(0)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Search and select a Bokun tour to configure flight pricing for.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="arriveAirportCode">Arrival Airport Code *</Label>
                    <Input
                      id="arriveAirportCode"
                      value={formData.arriveAirportCode}
                      onChange={(e) => setFormData({ ...formData, arriveAirportCode: e.target.value.toUpperCase() })}
                      placeholder="e.g., ATH, SOF, IST"
                      maxLength={3}
                      className="uppercase"
                      data-testid="input-arrive-airport"
                    />
                    <p className="text-xs text-muted-foreground">
                      3-letter IATA code for the destination airport.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="departAirports">Departure Airports</Label>
                    <Input
                      id="departAirports"
                      value={formData.departAirports}
                      onChange={(e) => setFormData({ ...formData, departAirports: e.target.value.toUpperCase() })}
                      placeholder="LGW|STN|LTN|LHR|MAN"
                      data-testid="input-depart-airports"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pipe-separated UK airport codes to search from.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="durationNights">Duration (Nights) *</Label>
                    <Input
                      id="durationNights"
                      type="number"
                      min={1}
                      max={30}
                      value={formData.durationNights}
                      onChange={(e) => setFormData({ ...formData, durationNights: parseInt(e.target.value) || 7 })}
                      data-testid="input-duration"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="searchStartDate">Search Start Date *</Label>
                    <Input
                      id="searchStartDate"
                      value={formData.searchStartDate}
                      onChange={(e) => setFormData({ ...formData, searchStartDate: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      data-testid="input-start-date"
                    />
                    <p className="text-xs text-muted-foreground">
                      Start of date range to search for flights.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="searchEndDate">Search End Date *</Label>
                    <Input
                      id="searchEndDate"
                      value={formData.searchEndDate}
                      onChange={(e) => setFormData({ ...formData, searchEndDate: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      data-testid="input-end-date"
                    />
                    <p className="text-xs text-muted-foreground">
                      End of date range to search for flights.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="markupPercent">Markup Percentage *</Label>
                    <Input
                      id="markupPercent"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.markupPercent}
                      onChange={(e) => setFormData({ ...formData, markupPercent: parseFloat(e.target.value) || 0 })}
                      data-testid="input-markup"
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage markup on combined flight + tour price (before smart rounding).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-3 pt-2">
                      <Switch
                        checked={formData.isEnabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                        data-testid="switch-enabled"
                      />
                      <span className="text-sm">
                        {formData.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTestDialogOpen(true);
                      handleTestFlightApi();
                    }}
                    disabled={!formData.arriveAirportCode || !formData.searchStartDate || !formData.searchEndDate}
                    className="gap-2"
                    data-testid="button-test-api"
                  >
                    <Settings2 className="h-4 w-4" />
                    Test Flight API
                  </Button>

                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={resetForm} data-testid="button-cancel">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={
                        createMutation.isPending ||
                        updateMutation.isPending ||
                        !formData.bokunProductId ||
                        !formData.arriveAirportCode ||
                        !formData.searchStartDate ||
                        !formData.searchEndDate
                      }
                      className="gap-2"
                      data-testid="button-save"
                    >
                      <Save className="h-4 w-4" />
                      {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">How it Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>1. Configure:</strong> Link a Bokun tour to an arrival airport with date ranges and markup.
              </p>
              <p>
                <strong>2. Flight Search:</strong> System searches external flight API for cheapest flights per date.
              </p>
              <p>
                <strong>3. Combined Pricing:</strong> Flight price + Bokun land tour price + markup percentage.
              </p>
              <p>
                <strong>4. Smart Rounding:</strong> Final price rounded to nearest x49, x69, or x99 (e.g., £469, £599).
              </p>
              <p>
                <strong>5. Display:</strong> Tour detail page shows per-date pricing with flight included.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Flight API Test Results</DialogTitle>
            <DialogDescription>
              Testing search for {formData.departAirports} → {formData.arriveAirportCode}, {formData.durationNights} nights
            </DialogDescription>
          </DialogHeader>
          
          {isTestingApi ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Searching flights...</span>
            </div>
          ) : testResults?.error ? (
            <div className="py-4 text-center text-destructive">
              <p>Error: {testResults.error}</p>
            </div>
          ) : testResults ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">{testResults.count} flights found</Badge>
              </div>
              {testResults.offers && testResults.offers.length > 0 && (
                <div className="max-h-80 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Airline</TableHead>
                        <TableHead>Price/pp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testResults.offers.slice(0, 10).map((offer: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{offer.outdep?.split(" ")[0]}</TableCell>
                          <TableCell>{offer.depname}</TableCell>
                          <TableCell>{offer.outairlinename}</TableCell>
                          <TableCell>£{parseFloat(offer.fltnetpricepp).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
