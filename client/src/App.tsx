import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import DashboardLayout from "@/components/dashboard-layout";
import WhatsUpPage from "@/pages/whats-up";
import MarketsPage from "@/pages/markets";
import PortfolioPage from "@/pages/portfolio";
import AnalysisPage from "@/pages/analysis";
import EarningsPage from "@/pages/earnings";
import NewsPage from "@/pages/news";
import ChatPage from "@/pages/chat";
import SubscriptionPage from "@/pages/subscription";

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/whats-up" component={WhatsUpPage} />
        <Route path="/dashboard" component={MarketsPage} />
        <Route path="/dashboard/subscription" component={SubscriptionPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/earnings" component={EarningsPage} />
        <Route path="/news" component={NewsPage} />
        <Route path="/chat" component={ChatPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/whats-up" component={DashboardRoutes} />
      <Route path="/dashboard" component={DashboardRoutes} />
      <Route path="/dashboard/subscription" component={DashboardRoutes} />
      <Route path="/portfolio" component={DashboardRoutes} />
      <Route path="/analysis" component={DashboardRoutes} />
      <Route path="/earnings" component={DashboardRoutes} />
      <Route path="/news" component={DashboardRoutes} />
      <Route path="/chat" component={DashboardRoutes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
