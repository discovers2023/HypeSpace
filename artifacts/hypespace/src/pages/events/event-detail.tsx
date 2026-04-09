import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetEvent, useListGuests, useAddGuest, useRemoveGuest, useUpdateGuest, useListCampaigns, useListSocialPosts, useListReminders } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, Mail, Share2, ArrowLeft, Plus, Clock, Video, Settings, Trash2, MoreHorizontal, CheckCircle2, XCircle, Clock3, Search, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const addGuestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  company: z.string().optional(),
});

type AddGuestFormValues = z.infer<typeof addGuestSchema>;

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: event, isLoading: isEventLoading } = useGetEvent(1, eventId, { query: { enabled: !!eventId } });
  const { data: guests, isLoading: isGuestsLoading } = useListGuests(1, eventId, undefined, { query: { enabled: !!eventId } });
  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns(1, { eventId }, { query: { enabled: !!eventId } });
  const { data: socialPosts, isLoading: isSocialLoading } = useListSocialPosts(1, { eventId }, { query: { enabled: !!eventId } });
  const { data: reminders, isLoading: isRemindersLoading } = useListReminders(1, eventId, { query: { enabled: !!eventId } });
  
  const addGuest = useAddGuest();
  const removeGuest = useRemoveGuest();
  const updateGuest = useUpdateGuest();
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [guestToRemove, setGuestToRemove] = useState<{ id: number; name: string } | null>(null);

  const guestForm = useForm<AddGuestFormValues>({
    resolver: zodResolver(addGuestSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
    }
  });

  const invalidateGuests = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/organizations", 1, "events", eventId, "guests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizations", 1, "events", eventId] });
  };

  const onAddGuest = (data: AddGuestFormValues) => {
    addGuest.mutate(
      { orgId: 1, eventId, data },
      {
        onSuccess: () => {
          toast({ title: "Guest added" });
          invalidateGuests();
          setIsAddGuestOpen(false);
          guestForm.reset();
        },
        onError: (err) => {
          toast({ title: "Failed to add guest", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const onRemoveGuest = () => {
    if (!guestToRemove) return;
    removeGuest.mutate(
      { orgId: 1, eventId, guestId: guestToRemove.id },
      {
        onSuccess: () => {
          toast({ title: `${guestToRemove.name} removed from guest list` });
          invalidateGuests();
          setGuestToRemove(null);
        },
        onError: (err) => {
          toast({ title: "Failed to remove guest", description: err.message, variant: "destructive" });
          setGuestToRemove(null);
        },
      }
    );
  };

  const onUpdateStatus = (guestId: number, status: "invited" | "confirmed" | "declined") => {
    updateGuest.mutate(
      { orgId: 1, eventId, guestId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: `Guest marked as ${status}` });
          invalidateGuests();
        },
        onError: (err) => {
          toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  if (isEventLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-6">
            <Skeleton className="h-40 col-span-3" />
            <Skeleton className="h-40 col-span-1" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Event not found</h2>
          <Link href="/events">
            <Button variant="link" className="mt-4">Back to events</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const filteredGuests = guests?.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-12">
        <div>
          <Link href="/events">
            <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to events
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize bg-primary/10 text-primary border-primary/20">
                  {event.status}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {event.category.replace('_', ' ')}
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">{event.title}</h1>
              <p className="text-muted-foreground text-lg">{event.description}</p>
            </div>
            
            <div className="flex gap-3 shrink-0">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
              <Button className="bg-gradient-to-r from-primary to-accent border-0">
                Publish Event
              </Button>
            </div>
          </div>
        </div>

        {event.coverImageUrl && (
          <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden relative">
            <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-white">
              <div className="flex items-center gap-2 font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full">
                <Calendar className="h-5 w-5 text-primary" />
                {format(parseISO(event.startDate), "MMMM d, yyyy • h:mm a")}
              </div>
              <div className="flex items-center gap-2 font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full">
                {event.type === 'remote' ? <Video className="h-5 w-5 text-accent" /> : <MapPin className="h-5 w-5 text-accent" />}
                <span className="truncate max-w-[200px] md:max-w-md">
                  {event.type === 'remote' ? event.onlineUrl || 'Online' : event.location || 'Location TBD'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <Tabs defaultValue="guests" className="w-full">
              <TabsList className="w-full md:w-auto flex flex-wrap h-auto p-1 mb-6">
                <TabsTrigger value="guests" className="flex-1 md:flex-none py-2.5">
                  <Users className="h-4 w-4 mr-2" /> Guests
                </TabsTrigger>
                <TabsTrigger value="campaigns" className="flex-1 md:flex-none py-2.5">
                  <Mail className="h-4 w-4 mr-2" /> Campaigns
                </TabsTrigger>
                <TabsTrigger value="social" className="flex-1 md:flex-none py-2.5">
                  <Share2 className="h-4 w-4 mr-2" /> Social
                </TabsTrigger>
                <TabsTrigger value="reminders" className="flex-1 md:flex-none py-2.5">
                  <Clock className="h-4 w-4 mr-2" /> Reminders
                </TabsTrigger>
              </TabsList>

              <TabsContent value="guests" className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border">
                  <div className="relative w-full sm:max-w-sm">
                    <Input 
                      placeholder="Search guests..." 
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto">Import CSV</Button>
                    <Dialog open={isAddGuestOpen} onOpenChange={setIsAddGuestOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto">
                          <Plus className="mr-2 h-4 w-4" /> Add Guest
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Guest</DialogTitle>
                          <DialogDescription>Add a guest manually to your event list.</DialogDescription>
                        </DialogHeader>
                        <Form {...guestForm}>
                          <form onSubmit={guestForm.handleSubmit(onAddGuest)} className="space-y-4">
                            <FormField
                              control={guestForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="John Doe" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={guestForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Address</FormLabel>
                                  <FormControl>
                                    <Input placeholder="john@example.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={guestForm.control}
                              name="company"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Company (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Acme Corp" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="pt-4 flex justify-end">
                              <Button type="submit" disabled={addGuest.isPending}>
                                {addGuest.isPending ? "Adding..." : "Add Guest"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="rounded-xl border bg-card overflow-hidden">
                  {isGuestsLoading ? (
                    <div className="p-8 text-center"><Skeleton className="h-8 w-full mb-4" /><Skeleton className="h-8 w-full" /></div>
                  ) : filteredGuests?.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground mb-1">No guests found</p>
                      <p>Add your first guest or import a CSV to build your list.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Guest</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Company</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Added</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredGuests?.map((guest) => (
                            <tr key={guest.id} className="hover:bg-muted/30 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="font-medium text-foreground">{guest.name}</div>
                                <div className="text-muted-foreground text-xs">{guest.email}</div>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground text-sm">{guest.company || '—'}</td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className={`capitalize text-xs ${
                                  guest.status === 'confirmed' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                                  guest.status === 'invited'   ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' :
                                  guest.status === 'declined'  ? 'bg-red-500/10 text-red-700 border-red-200' : ''
                                }`}>
                                  {guest.status === 'confirmed' && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                                  {guest.status === 'declined'  && <XCircle className="h-3 w-3 mr-1 inline" />}
                                  {guest.status === 'invited'   && <Clock3 className="h-3 w-3 mr-1 inline" />}
                                  {guest.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground text-xs">
                                {guest.invitedAt ? format(parseISO(guest.invitedAt), "MMM d, yyyy") : '—'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    {guest.status !== 'confirmed' && (
                                      <DropdownMenuItem onClick={() => onUpdateStatus(guest.id, 'confirmed')}>
                                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                        Mark Confirmed
                                      </DropdownMenuItem>
                                    )}
                                    {guest.status !== 'invited' && (
                                      <DropdownMenuItem onClick={() => onUpdateStatus(guest.id, 'invited')}>
                                        <Clock3 className="mr-2 h-4 w-4 text-blue-600" />
                                        Mark Invited
                                      </DropdownMenuItem>
                                    )}
                                    {guest.status !== 'declined' && (
                                      <DropdownMenuItem onClick={() => onUpdateStatus(guest.id, 'declined')}>
                                        <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                                        Mark Declined
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setGuestToRemove({ id: guest.id, name: guest.name })}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Guest
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
              </TabsContent>

              <TabsContent value="campaigns">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Email Campaigns</CardTitle>
                        <CardDescription>Manage communications for this event</CardDescription>
                      </div>
                      <Link href="/campaigns/ai">
                        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isCampaignsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : campaigns?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No campaigns yet. Generate an AI campaign to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {campaigns?.map(campaign => (
                          <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div>
                              <div className="font-medium">{campaign.subject}</div>
                              <div className="text-sm text-muted-foreground capitalize flex gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px]">{campaign.type}</Badge>
                                <span>{campaign.status}</span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">View</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Social Media Posts</CardTitle>
                        <CardDescription>Schedule content to promote this event</CardDescription>
                      </div>
                      <Link href="/social">
                        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Post</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isSocialLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : socialPosts?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No social posts scheduled. Start promoting your event.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {socialPosts?.map(post => (
                          <div key={post.id} className="p-4 border rounded-lg flex flex-col justify-between">
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                                <span className="text-xs text-muted-foreground capitalize">{post.status}</span>
                              </div>
                              <p className="text-sm line-clamp-3">{post.content}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="w-full justify-center">View Post</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="reminders">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Automated Reminders</CardTitle>
                        <CardDescription>Keep your guests informed</CardDescription>
                      </div>
                      <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Reminder</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isRemindersLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : reminders?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No automated reminders set up.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reminders?.map(reminder => (
                          <div key={reminder.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <div className="font-medium">{reminder.subject}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Sends {reminder.offsetHours} hours {reminder.type.replace('_', ' ')}
                              </div>
                            </div>
                            <Badge variant={reminder.status === 'sent' ? 'default' : 'outline'} className="capitalize">
                              {reminder.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Event Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Confirmed Guests</span>
                    <span className="font-medium">{event.confirmedCount} / {event.capacity || '∞'}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: event.capacity ? `${Math.min(100, (event.confirmedCount / event.capacity) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <div className="text-2xl font-bold">{event.guestCount}</div>
                    <div className="text-xs text-muted-foreground">Total Invited</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-xs text-muted-foreground">Waitlisted</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/campaigns/ai">
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Mail className="h-4 w-4 mr-2 text-primary" />
                    Send Announcement
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Share2 className="h-4 w-4 mr-2 text-accent" />
                  Promote on Social
                </Button>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Activity className="h-4 w-4 mr-2 text-green-500" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={!!guestToRemove} onOpenChange={(open) => !open && setGuestToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove guest?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{guestToRemove?.name}</strong> will be removed from this event's guest list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemoveGuest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
