import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import EventList from "@/pages/events/event-list";
import EventNew from "@/pages/events/event-new";
import EventDetail from "@/pages/events/event-detail";
import CampaignList from "@/pages/campaigns/campaign-list";
import CampaignAi from "@/pages/campaigns/campaign-ai";
import SocialList from "@/pages/social/social-list";
import TeamList from "@/pages/team/team-list";
import Settings from "@/pages/settings";
import AcceptInvite from "@/pages/accept-invite";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/events" component={EventList} />
      <Route path="/events/new" component={EventNew} />
      <Route path="/events/:id" component={EventDetail} />
      <Route path="/campaigns" component={CampaignList} />
      <Route path="/campaigns/ai" component={CampaignAi} />
      <Route path="/social" component={SocialList} />
      <Route path="/team" component={TeamList} />
      <Route path="/settings" component={Settings} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
