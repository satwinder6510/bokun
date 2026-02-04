import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import type { CityTax } from "@shared/schema";

const CURRENCIES = ["EUR", "GBP", "USD", "CHF"];
const COUNTRY_CODES = [
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "AT", name: "Austria" },
  { code: "PT", name: "Portugal" },
  { code: "GR", name: "Greece" },
  { code: "HR", name: "Croatia" },
  { code: "CZ", name: "Czech Republic" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
];

interface TaxFormData {
  cityName: string;
  countryCode: string;
  pricingType: "flat" | "star_rating";
  taxPerNightPerPerson: string;
  rate1Star: string;
  rate2Star: string;
  rate3Star: string;
  rate4Star: string;
  rate5Star: string;
  currency: string;
  notes: string;
  effectiveDate: string;
}

const defaultFormData: TaxFormData = {
  cityName: "",
  countryCode: "IT",
  pricingType: "flat",
  taxPerNightPerPerson: "",
  rate1Star: "",
  rate2Star: "",
  rate3Star: "",
  rate4Star: "",
  rate5Star: "",
  currency: "EUR",
  notes: "",
  effectiveDate: "",
};

export default function AdminCityTaxes() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<CityTax | null>(null);
  const [formData, setFormData] = useState<TaxFormData>(defaultFormData);

  const { data: cityTaxes = [], isLoading } = useQuery<CityTax[]>({
    queryKey: ["/api/admin/city-taxes"],
  });

  const createMutation = useMutation({
    mutationFn: (data: TaxFormData) =>
      apiRequest("POST", "/api/admin/city-taxes", {
        cityName: data.cityName,
        countryCode: data.countryCode,
        pricingType: data.pricingType,
        taxPerNightPerPerson: parseFloat(data.taxPerNightPerPerson) || 0,
        rate1Star: data.rate1Star ? parseFloat(data.rate1Star) : null,
        rate2Star: data.rate2Star ? parseFloat(data.rate2Star) : null,
        rate3Star: data.rate3Star ? parseFloat(data.rate3Star) : null,
        rate4Star: data.rate4Star ? parseFloat(data.rate4Star) : null,
        rate5Star: data.rate5Star ? parseFloat(data.rate5Star) : null,
        currency: data.currency,
        notes: data.notes || null,
        effectiveDate: data.effectiveDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-taxes"] });
      toast({ title: "City tax created successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create city tax", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaxFormData }) =>
      apiRequest("PUT", `/api/admin/city-taxes/${id}`, {
        cityName: data.cityName,
        countryCode: data.countryCode,
        pricingType: data.pricingType,
        taxPerNightPerPerson: parseFloat(data.taxPerNightPerPerson) || 0,
        rate1Star: data.rate1Star ? parseFloat(data.rate1Star) : null,
        rate2Star: data.rate2Star ? parseFloat(data.rate2Star) : null,
        rate3Star: data.rate3Star ? parseFloat(data.rate3Star) : null,
        rate4Star: data.rate4Star ? parseFloat(data.rate4Star) : null,
        rate5Star: data.rate5Star ? parseFloat(data.rate5Star) : null,
        currency: data.currency,
        notes: data.notes || null,
        effectiveDate: data.effectiveDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-taxes"] });
      toast({ title: "City tax updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update city tax", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/city-taxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-taxes"] });
      toast({ title: "City tax deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete city tax", description: error.message, variant: "destructive" });
    },
  });

  const openAddDialog = () => {
    setEditingTax(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (tax: CityTax) => {
    setEditingTax(tax);
    setFormData({
      cityName: tax.cityName,
      countryCode: tax.countryCode || "IT",
      pricingType: (tax.pricingType as "flat" | "star_rating") || "flat",
      taxPerNightPerPerson: tax.taxPerNightPerPerson?.toString() || "",
      rate1Star: tax.rate1Star?.toString() || "",
      rate2Star: tax.rate2Star?.toString() || "",
      rate3Star: tax.rate3Star?.toString() || "",
      rate4Star: tax.rate4Star?.toString() || "",
      rate5Star: tax.rate5Star?.toString() || "",
      currency: tax.currency || "EUR",
      notes: tax.notes || "",
      effectiveDate: tax.effectiveDate ? new Date(tax.effectiveDate).toISOString().split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTax(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cityName) {
      toast({ title: "City name is required", variant: "destructive" });
      return;
    }
    if (formData.pricingType === "flat" && !formData.taxPerNightPerPerson) {
      toast({ title: "Tax amount is required for flat rate", variant: "destructive" });
      return;
    }
    if (formData.pricingType === "star_rating") {
      const hasAtLeastOneRate = formData.rate1Star || formData.rate2Star || formData.rate3Star || formData.rate4Star || formData.rate5Star;
      if (!hasAtLeastOneRate) {
        toast({ title: "At least one star rating rate is required", variant: "destructive" });
        return;
      }
    }
    if (editingTax) {
      updateMutation.mutate({ id: editingTax.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getCountryName = (code: string) => {
    return COUNTRY_CODES.find(c => c.code === code)?.name || code;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const latestUpdate = cityTaxes.length > 0
    ? cityTaxes.reduce((latest, tax) => {
        const taxDate = new Date(tax.updatedAt);
        return taxDate > latest ? taxDate : latest;
      }, new Date(0))
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/packages">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="heading-city-taxes">
              <Building2 className="w-8 h-8" />
              City Taxes
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage locally paid city taxes that must be displayed alongside package prices
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} data-testid="button-add-tax">
                <Plus className="w-4 h-4 mr-2" />
                Add City Tax
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTax ? "Edit City Tax" : "Add City Tax"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cityName">City Name *</Label>
                    <Input
                      id="cityName"
                      value={formData.cityName}
                      onChange={(e) => setFormData({ ...formData, cityName: e.target.value })}
                      placeholder="e.g., Rome, Venice, Florence"
                      data-testid="input-city-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="countryCode">Country</Label>
                    <Select
                      value={formData.countryCode}
                      onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                    >
                      <SelectTrigger data-testid="select-country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricingType">Pricing Type</Label>
                    <Select
                      value={formData.pricingType}
                      onValueChange={(value: "flat" | "star_rating") => setFormData({ ...formData, pricingType: value })}
                    >
                      <SelectTrigger data-testid="select-pricing-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="star_rating">By Star Rating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formData.pricingType === "flat" ? (
                  <div className="space-y-2">
                    <Label htmlFor="taxPerNightPerPerson">Tax per Night per Person *</Label>
                    <Input
                      id="taxPerNightPerPerson"
                      type="number"
                      step="0.01"
                      value={formData.taxPerNightPerPerson}
                      onChange={(e) => setFormData({ ...formData, taxPerNightPerPerson: e.target.value })}
                      placeholder="e.g., 3.50"
                      data-testid="input-tax-amount"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Rates by Hotel Star Rating (per night per person)</Label>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="rate1Star" className="text-xs text-muted-foreground">1 Star</Label>
                        <Input
                          id="rate1Star"
                          type="number"
                          step="0.01"
                          value={formData.rate1Star}
                          onChange={(e) => setFormData({ ...formData, rate1Star: e.target.value })}
                          placeholder="0.00"
                          data-testid="input-rate-1-star"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rate2Star" className="text-xs text-muted-foreground">2 Star</Label>
                        <Input
                          id="rate2Star"
                          type="number"
                          step="0.01"
                          value={formData.rate2Star}
                          onChange={(e) => setFormData({ ...formData, rate2Star: e.target.value })}
                          placeholder="0.00"
                          data-testid="input-rate-2-star"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rate3Star" className="text-xs text-muted-foreground">3 Star</Label>
                        <Input
                          id="rate3Star"
                          type="number"
                          step="0.01"
                          value={formData.rate3Star}
                          onChange={(e) => setFormData({ ...formData, rate3Star: e.target.value })}
                          placeholder="0.00"
                          data-testid="input-rate-3-star"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rate4Star" className="text-xs text-muted-foreground">4 Star</Label>
                        <Input
                          id="rate4Star"
                          type="number"
                          step="0.01"
                          value={formData.rate4Star}
                          onChange={(e) => setFormData({ ...formData, rate4Star: e.target.value })}
                          placeholder="0.00"
                          data-testid="input-rate-4-star"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rate5Star" className="text-xs text-muted-foreground">5 Star</Label>
                        <Input
                          id="rate5Star"
                          type="number"
                          step="0.01"
                          value={formData.rate5Star}
                          onChange={(e) => setFormData({ ...formData, rate5Star: e.target.value })}
                          placeholder="0.00"
                          data-testid="input-rate-5-star"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="effectiveDate">Effective Date (optional)</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    data-testid="input-effective-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional information about this tax..."
                    rows={2}
                    data-testid="input-notes"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-tax"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingTax ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {latestUpdate && (
          <p className="text-sm text-muted-foreground mb-4">
            City Tax rates correct as of {formatDate(latestUpdate)}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>City Tax Rates</CardTitle>
            <CardDescription>
              These taxes are paid locally by guests and must be shown separately from the package price.
              Tax is calculated per night per person.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : cityTaxes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No city taxes configured yet.</p>
                <p className="text-sm mt-1">Click "Add City Tax" to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Tax Rate(s)</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityTaxes.map((tax) => (
                    <TableRow key={tax.id} data-testid={`city-tax-row-${tax.id}`}>
                      <TableCell className="font-medium">{tax.cityName}</TableCell>
                      <TableCell>{getCountryName(tax.countryCode)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${tax.pricingType === 'star_rating' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                          {tax.pricingType === 'star_rating' ? 'By Star' : 'Flat'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {tax.pricingType === 'star_rating' ? (
                          <div className="space-y-0.5">
                            {tax.rate1Star != null && <div>1★: {tax.currency} {tax.rate1Star.toFixed(2)}</div>}
                            {tax.rate2Star != null && <div>2★: {tax.currency} {tax.rate2Star.toFixed(2)}</div>}
                            {tax.rate3Star != null && <div>3★: {tax.currency} {tax.rate3Star.toFixed(2)}</div>}
                            {tax.rate4Star != null && <div>4★: {tax.currency} {tax.rate4Star.toFixed(2)}</div>}
                            {tax.rate5Star != null && <div>5★: {tax.currency} {tax.rate5Star.toFixed(2)}</div>}
                          </div>
                        ) : (
                          <div>{tax.currency} {tax.taxPerNightPerPerson?.toFixed(2) || '0.00'}</div>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(tax.effectiveDate)}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={tax.notes || ""}>
                        {tax.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tax)}
                            data-testid={`button-edit-tax-${tax.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Delete tax for ${tax.cityName}?`)) {
                                deleteMutation.mutate(tax.id);
                              }
                            }}
                            data-testid={`button-delete-tax-${tax.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
