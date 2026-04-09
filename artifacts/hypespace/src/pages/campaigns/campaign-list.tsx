import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useListCampaigns, useDeleteCampaign } from "@workspace/api-client-react";
import { Mail, Plus, Search, MoreHorizontal, Trash2, Edit, Calendar, LayoutTemplate } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function CampaignList() {
  const { data: campaigns, isLoading } = useListCampaigns(1);
  const deleteCampaign = useDeleteCampaign();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<number | null>(null);

  const filteredCampaigns = campaigns?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = () => {
    if (!campaignToDelete) return;
    
    deleteCampaign.mutate({ campaignId: campaignToDelete }, {
      onSuccess: () => {
        toast({ title: "Campaign deleted successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", 1, "campaigns"] });
        setCampaignToDelete(null);
      },
      onError: (error) => {
        toast({ 
          title: "Failed to delete campaign", 
          description: error.message || "An error occurred",
          variant: "destructive" 
        });
        setCampaignToDelete(null);
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'scheduled': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'draft': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'failed': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return '';
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Manage email communications for your events.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/campaigns/ai">
              <Button className="bg-gradient-to-r from-primary to-accent border-0 text-white shadow-md hover:shadow-lg transition-shadow">
                <Plus className="mr-2 h-4 w-4" />
                New AI Campaign
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search campaigns..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            <Badge variant="secondary" className="px-3 py-1 cursor-pointer bg-primary/10 text-primary border-primary/20 whitespace-nowrap">All</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Drafts</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Scheduled</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Sent</Badge>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredCampaigns?.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 opacity-40" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No campaigns found</h3>
              <p className="max-w-sm mb-6">Create your first email campaign to start engaging with your audience.</p>
              <Link href="/campaigns/ai">
                <Button>Generate AI Campaign</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Campaign</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Performance</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Date</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCampaigns?.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground mb-1">{campaign.name}</div>
                        <div className="text-muted-foreground text-xs truncate max-w-xs">{campaign.subject}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`capitalize ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-muted-foreground text-xs capitalize">
                          <LayoutTemplate className="h-3 w-3 mr-1" />
                          {campaign.type}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {campaign.status === 'sent' ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Open Rate</span>
                              <span className="font-medium">{campaign.openRate ? `${(campaign.openRate * 100).toFixed(1)}%` : '-'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Click Rate</span>
                              <span className="font-medium">{campaign.clickRate ? `${(campaign.clickRate * 100).toFixed(1)}%` : '-'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {campaign.scheduledAt ? format(parseISO(campaign.scheduledAt), "MMM d, yyyy") : 
                           campaign.sentAt ? format(parseISO(campaign.sentAt), "MMM d, yyyy") : 
                           format(parseISO(campaign.createdAt), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit Campaign</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => setCampaignToDelete(campaign.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete Campaign</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
