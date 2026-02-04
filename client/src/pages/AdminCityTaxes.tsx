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
  taxPerNightPerPerson: string;
  currency: string;
  notes: string;
  effectiveDate: string;
}

const defaultFormData: TaxFormData = {
  cityName: "",
  countryCode: "IT",
  taxPerNightPerPerson: "",
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
        ...data,
        taxPerNightPerPerson: parseFloat(data.taxPerNightPerPerson),
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
        ...data,
        taxPerNightPerPerson: parseFloat(data.taxPerNightPerPerson),
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
      taxPerNightPerPerson: tax.taxPerNightPerPerson.toString(),
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
    if (!formData.cityName || !formData.taxPerNightPerPerson) {
      toast({ title: "City name and tax amount are required", variant: "destructive" });
      return;
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
                    <TableHead className="text-right">Tax/Night/Person</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityTaxes.map((tax) => (
                    <TableRow key={tax.id} data-testid={`city-tax-row-${tax.id}`}>
                      <TableCell className="font-medium">{tax.cityName}</TableCell>
                      <TableCell>{getCountryName(tax.countryCode)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {tax.currency} {tax.taxPerNightPerPerson.toFixed(2)}
                      </TableCell>
                      <TableCell>{formatDate(tax.effectiveDate)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tax.notes || ""}>
                        {tax.notes || "-"}
                      </TableCell>
                      <TableCell>{formatDate(tax.updatedAt)}</TableCell>
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
