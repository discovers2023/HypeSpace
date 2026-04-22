import type { ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/auth-provider";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import EventList from "@/pages/events/event-list";
import EventDetail from "@/pages/events/event-detail";
import EventEdit from "@/pages/events/event-edit";
import CampaignList from "@/pages/campaigns/campaign-list";
import CampaignAi from "@/pages/campaigns/campaign-ai";
import CampaignEdit from "@/pages/campaigns/campaign-edit";
import SocialList from "@/pages/social/social-list";
import TeamList from "@/pages/team/team-list";
import Settings from "@/pages/settings";
import Onboarding from "@/pages/onboarding";
import Profile from "@/pages/profile";
import AcceptInvite from "@/pages/accept-invite";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import CalendarPage from "@/pages/calendar";
import PublicEvent from "@/pages/public-event";
import About from "@/pages/about";
import Careers from "@/pages/careers";
import AdminDashboard from "@/pages/admin";

const queryClient = new QueryClient();

function SetupRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Redirect to={`/events/${id}`} />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  // While /api/auth/me is in flight, render nothing — avoids flashing /login
  // on hard refresh for users who actually have a valid session.
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes — no auth required */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/about" component={About} />
      <Route path="/careers" component={Careers} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/e/:slug" component={PublicEvent} />
      {/* /admin has its own admin-credential gate — intentionally public from the user-auth guard's perspective */}
      <Route path="/admin" component={AdminDashboard} />

      {/* Everything else requires authentication */}
      <Route>
        <RequireAuth>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/onboarding" component={Onboarding} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/events" component={EventList} />
            <Route path="/events/new"><Redirect to="/events" /></Route>
            <Route path="/events/:id/setup"><SetupRedirect /></Route>
            <Route path="/events/:id" component={EventDetail} />
            <Route path="/events/:id/edit" component={EventEdit} />
            <Route path="/campaigns" component={CampaignList} />
            <Route path="/campaigns/ai" component={CampaignAi} />
            <Route path="/campaigns/:id/edit" component={CampaignEdit} />
            <Route path="/social" component={SocialList} />
            <Route path="/team" component={TeamList} />
            <Route path="/settings" component={Settings} />
            <Route path="/profile" component={Profile} />
            <Route component={NotFound} />
          </Switch>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
