import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useListCampaigns, useDeleteCampaign, useListEvents, type Event, type Campaign } from "@workspace/api-client-react";
import {
  Mail, Plus, Search, Trash2, Edit, Calendar, Send, FileText,
  Sparkles, MoreVertical, Users, BarChart2, Clock, CheckCircle2,
  AlertCircle, Megaphone, ChevronDown, ChevronRight, Eye,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CampaignCreationModal } from "@/components/campaigns/campaign-creation-modal";

const ORG_ID = 1;

type StatusFilter = "all" | "draft" | "scheduled" | "sent";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  draft: { label: "Draft", icon: <FileText className="h-3 w-3" />, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  scheduled: { label: "Scheduled", icon: <Clock className="h-3 w-3" />, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  sent: { label: "Sent", icon: <CheckCircle2 className="h-3 w-3" />, bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  failed: { label: "Failed", icon: <AlertCircle className="h-3 w-3" />, bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  invitation: <Mail className="h-3.5 w-3.5" />,
  reminder: <Clock className="h-3.5 w-3.5" />,
  followup: <CheckCircle2 className="h-3.5 w-3.5" />,
  announcement: <Megaphone className="h-3.5 w-3.5" />,
  custom: <FileText className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  invitation: "from-violet-500 to-purple-700",
  reminder: "from-amber-500 to-orange-600",
  followup: "from-emerald-500 to-teal-600",
  announcement: "from-blue-500 to-indigo-600",
  custom: "from-slate-500 to-slate-700",
};

export default function CampaignList() {
  const { data: campaigns, isLoading } = useListCampaigns(ORG_ID);
  const { data: events } = useListEvents(ORG_ID);
  const deleteCampaign = useDeleteCampaign();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [campaignToDelete, setCampaignToDelete] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const eventsMap = new Map((events || []).map((e) => [e.id, e]));

  const filtered = campaigns?.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: campaigns?.length ?? 0,
    draft: campaigns?.filter((c) => c.status === "draft").length ?? 0,
    scheduled: campaigns?.filter((c) => c.status === "scheduled").length ?? 0,
    sent: campaigns?.filter((c) => c.status === "sent").length ?? 0,
  };

  // Group campaigns by event
  const grouped = new Map<string, { event: Event | null | undefined; campaigns: Campaign[] }>();
  (filtered || []).forEach((c) => {
    const key = c.eventId ? `event-${c.eventId}` : "standalone";
    if (!grouped.has(key)) {
      grouped.set(key, {
        event: c.eventId ? eventsMap.get(c.eventId) : null,
        campaigns: [],
      });
    }
    grouped.get(key)!.campaigns.push(c);
  });

  const handleDelete = () => {
    if (!campaignToDelete) return;
    deleteCampaign.mutate(
      { orgId: ORG_ID, campaignId: campaignToDelete },
      {
        onSuccess: () => {
          toast({ title: "Campaign deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "campaigns"] });
          setCampaignToDelete(null);
        },
        onError: (err) => {
          toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
          setCampaignToDelete(null);
        },
      },
    );
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "scheduled", label: "Scheduled" },
    { key: "sent", label: "Sent" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Create, edit, and send email campaigns for your events.</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
            <Link href="/campaigns/ai">
              <Button variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Generate
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        {!isLoading && (campaigns?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: counts.all, icon: <Mail className="h-4 w-4 text-muted-foreground" />, color: "bg-muted/50" },
              { label: "Drafts", value: counts.draft, icon: <FileText className="h-4 w-4 text-amber-600" />, color: "bg-amber-50" },
              { label: "Scheduled", value: counts.scheduled, icon: <Clock className="h-4 w-4 text-blue-600" />, color: "bg-blue-50" },
              { label: "Sent", value: counts.sent, icon: <Send className="h-4 w-4 text-green-600" />, color: "bg-green-50" },
            ].map((stat) => (
              <div key={stat.label} className={`flex items-center gap-3 p-3 rounded-xl border ${stat.color}`}>
                {stat.icon}
                <div>
                  <p className="text-xl font-bold leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns…"
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg border">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : (filtered?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-5">
              <Mail className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm || statusFilter !== "all" ? "No campaigns found" : "No campaigns yet"}
            </h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filter."
                : "Create your first campaign to start engaging your audience."}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Create Campaign
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([key, { event, campaigns: groupCampaigns }]) => {
              const isCollapsed = collapsedGroups.has(key);
              return (
                <div key={key} className="rounded-xl border overflow-hidden">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left border-b"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    {event ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm">{event.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {event.startDate ? format(parseISO(event.startDate), "MMM d, yyyy") : ""}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">{event.status}</Badge>
                      </>
                    ) : (
                      <span className="font-semibold text-sm text-muted-foreground">Standalone Campaigns</span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">{groupCampaigns.length} campaign{groupCampaigns.length !== 1 ? "s" : ""}</span>
                  </button>

                  {/* Campaign rows */}
                  {!isCollapsed && (
                    <div className="divide-y">
                      {groupCampaigns.map((campaign) => {
                        const s = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
                        const gradientClass = TYPE_COLOR[campaign.type] ?? TYPE_COLOR.custom;
                        const dateLabel = campaign.sentAt
                          ? `Sent ${format(parseISO(campaign.sentAt), "MMM d, yyyy")}`
                          : campaign.scheduledAt
                          ? `Scheduled ${format(parseISO(campaign.scheduledAt), "MMM d, yyyy")}`
                          : `Created ${format(parseISO(campaign.createdAt), "MMM d, yyyy")}`;

                        return (
                          <div key={campaign.id} className="group flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors">
                            <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white shrink-0 mt-0.5`}>
                              {TYPE_ICON[campaign.type] ?? <FileText className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-sm">{campaign.name}</span>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                                  {s.icon}{s.label}
                                </span>
                              </div>
                              {/* Subject line preview */}
                              <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                                📧 {campaign.subject}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {campaign.recipientCount != null && campaign.recipientCount > 0 && (
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{campaign.recipientCount.toLocaleString()} recipients</span>
                                )}
                                {campaign.status === "sent" && campaign.openRate != null && (
                                  <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3" />{(campaign.openRate * 100).toFixed(1)}% opens</span>
                                )}
                                {campaign.status === "sent" && campaign.clickRate != null && (
                                  <span className="flex items-center gap-1 text-blue-500"><BarChart2 className="h-3 w-3" />{(campaign.clickRate * 100).toFixed(1)}% clicks</span>
                                )}
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateLabel}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation(`/campaigns/${campaign.id}/edit`)}>
                                {campaign.status === "sent"
                                  ? <><Eye className="h-3 w-3 mr-1" />View</>
                                  : <><Edit className="h-3 w-3 mr-1" />Edit</>}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setLocation(`/campaigns/${campaign.id}/edit`)}>
                                    <Edit className="mr-2 h-4 w-4" />Edit campaign
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setCampaignToDelete(campaign.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={(o) => !o && setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CampaignCreationModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </AppLayout>
  );
}
