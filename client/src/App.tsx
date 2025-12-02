import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CartProvider } from "@/contexts/CartContext";
import Homepage from "@/pages/Homepage";
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
import AdminPackages from "@/pages/AdminPackages";
import AdminReviews from "@/pages/AdminReviews";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TwoFactorSetup from "@/pages/TwoFactorSetup";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Homepage} />
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
      <Route path="/login" component={Login} />
      <Route path="/2fa-setup" component={TwoFactorSetup} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/faq">
        <ProtectedRoute>
          <AdminFAQ />
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
