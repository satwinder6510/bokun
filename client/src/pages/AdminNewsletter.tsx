import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Mail,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface NewsletterSubscriber {
  id: number;
  email: string;
  isActive: boolean;
  subscribedAt: string;
}

export default function AdminNewsletter() {
  const { sessionToken } = useAdminAuth();
  const { toast } = useToast();

  const { data: subscribers, isLoading } = useQuery<NewsletterSubscriber[]>({
    queryKey: ['/api/admin/newsletter/subscribers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/newsletter/subscribers', {
        headers: {
          'x-admin-session': sessionToken || ''
        }
      });
      if (!response.ok) throw new Error('Failed to fetch subscribers');
      return response.json();
    },
    enabled: !!sessionToken,
  });

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/newsletter/export', {
        headers: {
          'x-admin-session': sessionToken || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to export subscribers');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'newsletter-subscribers.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: "Newsletter subscribers exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export subscribers",
        variant: "destructive",
      });
    }
  };

  const activeCount = subscribers?.filter(s => s.isActive).length || 0;
  const totalCount = subscribers?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Newsletter Subscribers</h1>
              <p className="text-muted-foreground">Manage email subscriptions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-subscribers">{totalCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-active-subscribers">{activeCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-unsubscribed">{totalCount - activeCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Subscribers</CardTitle>
            <Button onClick={handleExport} disabled={!subscribers?.length} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !subscribers?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No subscribers yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscribed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((subscriber) => (
                    <TableRow key={subscriber.id} data-testid={`row-subscriber-${subscriber.id}`}>
                      <TableCell className="font-medium" data-testid={`text-email-${subscriber.id}`}>
                        {subscriber.email}
                      </TableCell>
                      <TableCell>
                        {subscriber.isActive ? (
                          <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${subscriber.id}`}>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-status-${subscriber.id}`}>
                            <XCircle className="h-3 w-3 mr-1" />
                            Unsubscribed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-date-${subscriber.id}`}>
                        {format(new Date(subscriber.subscribedAt), "dd MMM yyyy, HH:mm")}
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
