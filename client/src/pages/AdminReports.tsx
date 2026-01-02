import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { 
  ArrowLeft, 
  LogOut, 
  Download, 
  Calendar,
  Mail,
  Phone,
  MessageSquare,
  ExternalLink,
  Filter,
  Globe
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import type { PackageEnquiry, TourEnquiry } from "@shared/schema";

type DateRange = "today" | "yesterday" | "last7days" | "last30days" | "custom";

export default function AdminReports() {
  const [, setLocation] = useLocation();
  const { logout } = useAdminAuth();
  const [dateRange, setDateRange] = useState<DateRange>("yesterday");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [enquiryType, setEnquiryType] = useState<"all" | "packages" | "tours">("all");

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const { data: packageEnquiries = [], isLoading: loadingPackages } = useQuery<PackageEnquiry[]>({
    queryKey: ["/api/admin/enquiries"],
  });

  const { data: tourEnquiries = [], isLoading: loadingTours } = useQuery<TourEnquiry[]>({
    queryKey: ["/api/admin/tour-enquiries"],
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "last7days":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "last30days":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case "custom":
        return {
          start: customStartDate ? startOfDay(parseISO(customStartDate)) : startOfDay(subDays(now, 7)),
          end: customEndDate ? endOfDay(parseISO(customEndDate)) : endOfDay(now),
        };
      default:
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    }
  };

  const { start, end } = getDateRange();

  const filteredPackageEnquiries = packageEnquiries.filter((enquiry) => {
    const createdAt = new Date(enquiry.createdAt);
    return isWithinInterval(createdAt, { start, end });
  });

  const filteredTourEnquiries = tourEnquiries.filter((enquiry) => {
    const createdAt = new Date(enquiry.createdAt);
    return isWithinInterval(createdAt, { start, end });
  });

  const allEnquiries = [
    ...filteredPackageEnquiries.map(e => ({ ...e, type: "package" as const })),
    ...filteredTourEnquiries.map(e => ({ ...e, type: "tour" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const displayEnquiries = enquiryType === "packages" 
    ? allEnquiries.filter(e => e.type === "package")
    : enquiryType === "tours"
    ? allEnquiries.filter(e => e.type === "tour")
    : allEnquiries;

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Time",
      "Type",
      "Name",
      "Email",
      "Phone",
      "Package/Tour",
      "Preferred Dates",
      "Travelers",
      "Notes/Message",
      "Referrer",
      "Status"
    ];

    const rows = displayEnquiries.map(enquiry => {
      const date = new Date(enquiry.createdAt);
      const packageTitle = enquiry.type === "package" 
        ? (enquiry as PackageEnquiry).packageTitle 
        : (enquiry as TourEnquiry).productTitle;
      const preferredDates = enquiry.type === "package"
        ? (enquiry as PackageEnquiry).preferredDates || ""
        : (enquiry as TourEnquiry).departureDate || "";
      
      return [
        format(date, "yyyy-MM-dd"),
        format(date, "HH:mm"),
        enquiry.type === "package" ? "Flight Package" : "Land Tour",
        `${enquiry.firstName} ${enquiry.lastName}`,
        enquiry.email,
        enquiry.phone,
        packageTitle,
        preferredDates,
        enquiry.numberOfTravelers?.toString() || "",
        enquiry.message?.replace(/"/g, '""') || "",
        enquiry.referrer || "",
        enquiry.status
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `enquiries-report-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = loadingPackages || loadingTours;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Enquiry Reports</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CardDescription>Filter enquiries by date range and type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                    <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="last7days">Last 7 Days</SelectItem>
                      <SelectItem value="last30days">Last 30 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateRange === "custom" && (
                  <>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        data-testid="input-start-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        data-testid="input-end-date"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Enquiry Type</Label>
                  <Select value={enquiryType} onValueChange={(v) => setEnquiryType(v as typeof enquiryType)}>
                    <SelectTrigger className="w-[180px]" data-testid="select-enquiry-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Enquiries</SelectItem>
                      <SelectItem value="packages">Flight Packages Only</SelectItem>
                      <SelectItem value="tours">Land Tours Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={exportToCSV} className="ml-auto" data-testid="button-export-csv">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold" data-testid="text-total-enquiries">
                  {displayEnquiries.length}
                </div>
                <p className="text-sm text-muted-foreground">Total Enquiries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold" data-testid="text-package-enquiries">
                  {displayEnquiries.filter(e => e.type === "package").length}
                </div>
                <p className="text-sm text-muted-foreground">Flight Packages</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold" data-testid="text-tour-enquiries">
                  {displayEnquiries.filter(e => e.type === "tour").length}
                </div>
                <p className="text-sm text-muted-foreground">Land Tours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold" data-testid="text-with-notes">
                  {displayEnquiries.filter(e => e.message && e.message.trim()).length}
                </div>
                <p className="text-sm text-muted-foreground">With Notes</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Enquiries ({format(start, "d MMM yyyy")} - {format(end, "d MMM yyyy")})
              </CardTitle>
              <CardDescription>
                {displayEnquiries.length} enquiries found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading enquiries...</div>
              ) : displayEnquiries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No enquiries found for the selected date range
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Package/Tour</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Referrer</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayEnquiries.map((enquiry) => {
                        const date = new Date(enquiry.createdAt);
                        const packageTitle = enquiry.type === "package" 
                          ? (enquiry as PackageEnquiry).packageTitle 
                          : (enquiry as TourEnquiry).productTitle;
                        
                        return (
                          <TableRow key={`${enquiry.type}-${enquiry.id}`} data-testid={`row-enquiry-${enquiry.id}`}>
                            <TableCell className="whitespace-nowrap">
                              <div className="font-medium">{format(date, "d MMM yyyy")}</div>
                              <div className="text-sm text-muted-foreground">{format(date, "HH:mm")}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={enquiry.type === "package" ? "default" : "secondary"}>
                                {enquiry.type === "package" ? "Package" : "Tour"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{enquiry.firstName} {enquiry.lastName}</div>
                              {enquiry.numberOfTravelers && (
                                <div className="text-sm text-muted-foreground">
                                  {enquiry.numberOfTravelers} traveler{enquiry.numberOfTravelers > 1 ? "s" : ""}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <a 
                                  href={`mailto:${enquiry.email}`} 
                                  className="flex items-center gap-1 text-sm hover:text-primary"
                                  data-testid={`link-email-${enquiry.id}`}
                                >
                                  <Mail className="h-3 w-3" />
                                  {enquiry.email}
                                </a>
                                <a 
                                  href={`tel:${enquiry.phone}`} 
                                  className="flex items-center gap-1 text-sm hover:text-primary"
                                  data-testid={`link-phone-${enquiry.id}`}
                                >
                                  <Phone className="h-3 w-3" />
                                  {enquiry.phone}
                                </a>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate font-medium" title={packageTitle || undefined}>
                                {packageTitle}
                              </div>
                              {enquiry.type === "package" && (enquiry as PackageEnquiry).preferredDates && (
                                <div className="text-sm text-muted-foreground">
                                  Dates: {(enquiry as PackageEnquiry).preferredDates}
                                </div>
                              )}
                              {enquiry.type === "tour" && (enquiry as TourEnquiry).departureDate && (
                                <div className="text-sm text-muted-foreground">
                                  Departure: {(enquiry as TourEnquiry).departureDate}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[250px]">
                              {enquiry.message ? (
                                <div className="flex items-start gap-1">
                                  <MessageSquare className="h-3 w-3 mt-1 flex-shrink-0 text-muted-foreground" />
                                  <span className="text-sm" title={enquiry.message}>
                                    {enquiry.message.length > 100 
                                      ? `${enquiry.message.substring(0, 100)}...` 
                                      : enquiry.message}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">No notes</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {enquiry.referrer ? (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm" title={enquiry.referrer}>
                                    {enquiry.referrer.length > 25 
                                      ? `${enquiry.referrer.substring(0, 25)}...` 
                                      : enquiry.referrer}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">Direct</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  enquiry.status === "new" ? "default" :
                                  enquiry.status === "contacted" ? "secondary" :
                                  enquiry.status === "converted" ? "outline" : "destructive"
                                }
                              >
                                {enquiry.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
