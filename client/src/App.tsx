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
import { usePostHogPageView } from "@/hooks/usePostHogPageView";
import { useHappyFox } from "@/hooks/use-happyfox";

// Scroll to top on route change
function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}

// PostHog page view tracking
function PostHogPageTracker() {
  usePostHogPageView();
  return null;
}

// HappyFox chat loader for tour/package detail pages
function HappyFoxLoader() {
  useHappyFox();
  return null;
}
import Homepage from "@/pages/Homepage";
import { Redirect } from "wouter";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
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
import AdminPricingGenerator from "@/pages/AdminPricingGenerator";
import AdminSettings from "@/pages/AdminSettings";
import AdminMedia from "@/pages/AdminMedia";
import AdminHotels from "@/pages/AdminHotels";
import AdminContentImages from "@/pages/AdminContentImages";
import AdminNewsletter from "@/pages/AdminNewsletter";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import DesignPreview from "@/pages/DesignPreview";
import PreviewPackages from "@/pages/PreviewPackages";
import PreviewPackageDetail from "@/pages/PreviewPackageDetail";
import PreviewContact from "@/pages/PreviewContact";
import PreviewFAQ from "@/pages/PreviewFAQ";
import PreviewBlog from "@/pages/PreviewBlog";
import PreviewBlogPost from "@/pages/PreviewBlogPost";
import Collections from "@/pages/Collections";
import CollectionDetail from "@/pages/CollectionDetail";
import Destinations from "@/pages/Destinations";
import DestinationDetail from "@/pages/DestinationDetail";
import SpecialOffers from "@/pages/SpecialOffers";
import HeroConcepts from "@/pages/HeroConcepts";
import SearchResults from "@/pages/SearchResults";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Homepage} />
      <Route path="/tours">{() => <Redirect to="/packages" />}</Route>
      <Route path="/tour/:id">{() => <Redirect to="/packages" />}</Route>
      <Route path="/packages" component={Packages} />
      <Route path="/packages/:slug" component={PackageDetail} />
      <Route path="/search" component={SearchResults} />
      <Route path="/special-offers" component={SpecialOffers} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/booking/:reference" component={BookingConfirmation} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/contact" component={Contact} />
      <Route path="/faq" component={FAQ} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/collections" component={Collections} />
      <Route path="/collections/:tag" component={CollectionDetail} />
      <Route path="/destinations" component={Destinations} />
      <Route path="/destinations/:country" component={DestinationDetail} />
      <Route path="/Holidays" component={Destinations} />
      <Route path="/Holidays/:country" component={DestinationDetail} />
      <Route path="/Holidays/:country/:slug" component={PackageDetail} />
      <Route path="/design-preview" component={DesignPreview} />
      <Route path="/hero-concepts" component={HeroConcepts} />
      <Route path="/preview/packages" component={PreviewPackages} />
      <Route path="/preview/packages/:id" component={PreviewPackageDetail} />
      <Route path="/preview/tours">{() => <Redirect to="/preview/packages" />}</Route>
      <Route path="/preview/tours/:slug">{() => <Redirect to="/preview/packages" />}</Route>
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
      <Route path="/admin/pricing-generator">
        <ProtectedRoute>
          <AdminPricingGenerator />
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
      <Route path="/admin/content-images">
        <ProtectedRoute>
          <AdminContentImages />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/newsletter">
        <ProtectedRoute>
          <AdminNewsletter />
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
              <PostHogPageTracker />
              <HappyFoxLoader />
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
