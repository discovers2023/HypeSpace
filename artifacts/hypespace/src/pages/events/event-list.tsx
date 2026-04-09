import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { useListEvents, useDeleteEvent } from "@workspace/api-client-react";
import { Calendar, MapPin, Search, Globe, Plus, Trash2, Edit, MoreHorizontal, Video } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function EventList() {
  const { data: events, isLoading } = useListEvents();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const deleteEvent = useDeleteEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);

  const filteredEvents = events?.filter(event => 
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = () => {
    if (!eventToDelete) return;
    
    deleteEvent.mutate({ eventId: eventToDelete }, {
      onSuccess: () => {
        toast({ title: "Event deleted successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        setEventToDelete(null);
      },
      onError: (error) => {
        toast({ 
          title: "Failed to delete event", 
          description: error.message || "An error occurred",
          variant: "destructive" 
        });
        setEventToDelete(null);
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20';
      case 'draft': return 'bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/20';
      case 'completed': return 'bg-gray-500/10 text-gray-700 hover:bg-gray-500/20 border-gray-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-500/20';
      default: return '';
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground mt-1">Manage your upcoming and past events.</p>
          </div>
          <Link href="/events/new">
            <Button className="bg-gradient-to-r from-primary to-accent border-0 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search events..." 
              className="pl-9 bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <Badge variant="secondary" className="px-3 py-1 cursor-pointer whitespace-nowrap bg-primary/10 text-primary border-primary/20">All Events</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Upcoming</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Drafts</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Past</Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))
          ) : filteredEvents?.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-card rounded-xl border border-dashed">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-medium">No events found</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first event.</p>
              <Link href="/events/new">
                <Button variant="outline">Create Event</Button>
              </Link>
            </div>
          ) : (
            filteredEvents?.map(event => (
              <div 
                key={event.id} 
                className="group relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm hover-elevate transition-all overflow-hidden"
              >
                {event.coverImageUrl && (
                  <div className="h-32 w-full bg-muted overflow-hidden relative">
                    <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}
                
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className={`capitalize ${getStatusColor(event.status)}`}>
                      {event.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLocation(`/events/${event.id}`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => setEventToDelete(event.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete Event</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <Link href={`/events/${event.id}`}>
                    <h3 className="text-xl font-bold line-clamp-1 mb-2 group-hover:text-primary transition-colors cursor-pointer">{event.title}</h3>
                  </Link>
                  
                  <div className="space-y-2 mb-6 flex-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4 text-primary" />
                      {format(parseISO(event.startDate), "MMM d, yyyy • h:mm a")}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      {event.type === 'remote' || event.type === 'hybrid' ? (
                        <Video className="mr-2 h-4 w-4 text-accent" />
                      ) : (
                        <MapPin className="mr-2 h-4 w-4 text-accent" />
                      )}
                      <span className="line-clamp-1">
                        {event.type === 'remote' ? 'Online Event' : event.location || 'Location TBD'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {Array.from({ length: Math.min(3, event.confirmedCount || 0) }).map((_, i) => (
                          <div key={i} className="h-6 w-6 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {String.fromCharCode(65 + i)}
                          </div>
                        ))}
                        {event.confirmedCount > 3 && (
                          <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                            +{event.confirmedCount - 3}
                          </div>
                        )}
                        {event.confirmedCount === 0 && (
                          <span className="text-xs text-muted-foreground">No guests yet</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium">
                      {event.confirmedCount} <span className="text-muted-foreground font-normal">/ {event.capacity || '∞'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              and remove all associated data including guests and campaigns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
