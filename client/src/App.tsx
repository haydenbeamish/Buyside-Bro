import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import * as Sentry from "@sentry/react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import PreviewPage from "@/pages/preview";
import DashboardLayout from "@/components/dashboard-layout";
import WhatsUpPage from "@/pages/whats-up";
import MarketsPage from "@/pages/markets";
import PortfolioPage from "@/pages/portfolio";
import AnalysisPage from "@/pages/analysis";
import EarningsPage from "@/pages/earnings";
import NewsPage from "@/pages/news";
import ChatPage from "@/pages/chat";
import SubscriptionPage from "@/pages/subscription";
import WatchlistPage from "@/pages/watchlist";
import AdminPage from "@/pages/admin";

function ErrorFallback() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Something went wrong</h1>
      <p>Please refresh the page to try again.</p>
      <button onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/whats-up" component={WhatsUpPage} />
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/dashboard" component={MarketsPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/earnings" component={EarningsPage} />
        <Route path="/news" component={NewsPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/preview" component={PreviewPage} />
      <Route path="/:rest*" component={DashboardRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <ThemeProvider defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
