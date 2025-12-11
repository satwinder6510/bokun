import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CartProvider } from "@/contexts/CartContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";

// Scroll to top on route change
function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}
import Homepage from "@/pages/Homepage";
import Tours from "@/pages/Tours";
import TourDetail from "@/pages/TourDetail";
import Terms from "@/pages/Terms";
import Contact from "@/pages/Contact";
import FAQ from "@/pages/FAQ";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Checkout from "@/pages/Checkout";
import BookingConfirmation from "@/pages/BookingConfirmation";
import Packages from "@/pages/Packages";
import PackageDetail from "@/pages/PackageDetail";
import AdminFAQ from "@/pages/AdminFAQ";
import AdminBlog from "@/pages/AdminBlog";
import AdminPackages from "@/pages/AdminPackages";
import AdminReviews from "@/pages/AdminReviews";
import AdminTrackingNumbers from "@/pages/AdminTrackingNumbers";
import AdminUsers from "@/pages/AdminUsers";
import AdminFlightPricing from "@/pages/AdminFlightPricing";
import AdminSettings from "@/pages/AdminSettings";
import AdminMedia from "@/pages/AdminMedia";
import AdminHotels from "@/pages/AdminHotels";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import DesignPreview from "@/pages/DesignPreview";
import PreviewPackages from "@/pages/PreviewPackages";
import PreviewPackageDetail from "@/pages/PreviewPackageDetail";
import PreviewTours from "@/pages/PreviewTours";
import PreviewTourDetail from "@/pages/PreviewTourDetail";
import PreviewContact from "@/pages/PreviewContact";
import PreviewFAQ from "@/pages/PreviewFAQ";
import PreviewBlog from "@/pages/PreviewBlog";
import PreviewBlogPost from "@/pages/PreviewBlogPost";
import Collections from "@/pages/Collections";
import CollectionDetail from "@/pages/CollectionDetail";
import Destinations from "@/pages/Destinations";
import DestinationDetail from "@/pages/DestinationDetail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Homepage} />
      <Route path="/tours" component={Tours} />
      <Route path="/tour/:id" component={TourDetail} />
      <Route path="/packages" component={Packages} />
      <Route path="/packages/:slug" component={PackageDetail} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/booking/:reference" component={BookingConfirmation} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/faq" component={FAQ} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/holidays" component={Collections} />
      <Route path="/holidays/:tag" component={CollectionDetail} />
      <Route path="/destinations" component={Destinations} />
      <Route path="/destinations/:country" component={DestinationDetail} />
      <Route path="/Holidays" component={Destinations} />
      <Route path="/Holidays/:country" component={DestinationDetail} />
      <Route path="/Holidays/:country/:slug" component={PackageDetail} />
      <Route path="/design-preview" component={DesignPreview} />
      <Route path="/preview/packages" component={PreviewPackages} />
      <Route path="/preview/packages/:id" component={PreviewPackageDetail} />
      <Route path="/preview/tours" component={PreviewTours} />
      <Route path="/preview/tours/:slug" component={PreviewTourDetail} />
      <Route path="/preview/contact" component={PreviewContact} />
      <Route path="/preview/faq" component={PreviewFAQ} />
      <Route path="/preview/blog" component={PreviewBlog} />
      <Route path="/preview/blog/:slug" component={PreviewBlogPost} />
      <Route path="/login" component={Login} />
      <Route path="/admin/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/faq">
        <ProtectedRoute>
          <AdminFAQ />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/blog">
        <ProtectedRoute>
          <AdminBlog />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/packages">
        <ProtectedRoute>
          <AdminPackages />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reviews">
        <ProtectedRoute>
          <AdminReviews />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/tracking-numbers">
        <ProtectedRoute>
          <AdminTrackingNumbers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute requireSuperAdmin>
          <AdminUsers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/flight-pricing">
        <ProtectedRoute>
          <AdminFlightPricing />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute>
          <AdminSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/media">
        <ProtectedRoute>
          <AdminMedia />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/hotels">
        <ProtectedRoute>
          <AdminHotels />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <CurrencyProvider>
          <CartProvider>
            <TooltipProvider>
              <ScrollToTop />
              <Toaster />
              <Router />
            </TooltipProvider>
          </CartProvider>
        </CurrencyProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
