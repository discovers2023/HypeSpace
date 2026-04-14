import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useListSocialPosts, useDeleteSocialPost, useListEvents, useCreateSocialPost } from "@workspace/api-client-react";
import { Share2, Plus, Search, MoreHorizontal, Trash2, Edit, Calendar as CalendarIcon, UploadCloud, Twitter, Linkedin, Facebook, Instagram, AtSign, Music } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
const postSchema = z.object({
  eventId: z.string().optional(),
  platform: z.enum(["twitter", "linkedin", "facebook", "instagram", "threads", "tiktok"]),
  content: z.string().min(1, "Post content is required").max(280, "Post is too long"),
  scheduledAt: z.date().optional(),
  imageUrl: z.string().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

import { useAuth } from "@/components/auth-provider";

export default function SocialList() {
  const { activeOrgId } = useAuth();
  const { data: posts, isLoading } = useListSocialPosts(activeOrgId);
  const { data: events, isLoading: isEventsLoading } = useListEvents(activeOrgId);
  const deletePost = useDeleteSocialPost();
  const createPost = useCreateSocialPost();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      eventId: "",
      platform: "twitter",
      content: "",
      imageUrl: "",
    },
  });

  const filteredPosts = posts?.filter(p => 
    p.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.platform.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = () => {
    if (!postToDelete) return;
    
    deletePost.mutate({ postId: postToDelete }, {
      onSuccess: () => {
        toast({ title: "Post deleted successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", activeOrgId, "social-posts"] });
        setPostToDelete(null);
      },
      onError: (error) => {
        toast({ 
          title: "Failed to delete post", 
          description: error.message || "An error occurred",
          variant: "destructive" 
        });
        setPostToDelete(null);
      }
    });
  };

  const onSubmit = (data: PostFormValues) => {
    createPost.mutate(
      {
        orgId: activeOrgId,
        data: {
          eventId: data.eventId ? parseInt(data.eventId, 10) : undefined,
          platform: data.platform,
          content: data.content,
          imageUrl: data.imageUrl,
          scheduledAt: data.scheduledAt ? data.scheduledAt.toISOString() : undefined,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Social post scheduled successfully" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", activeOrgId, "social-posts"] });
          setIsCreateOpen(false);
          form.reset();
        },
        onError: (err) => {
          toast({ 
            title: "Failed to schedule post", 
            description: err.message, 
            variant: "destructive" 
          });
        }
      }
    );
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'twitter': return <Twitter className="h-4 w-4 text-[#1DA1F2]" />;
      case 'linkedin': return <Linkedin className="h-4 w-4 text-[#0A66C2]" />;
      case 'facebook': return <Facebook className="h-4 w-4 text-[#1877F2]" />;
      case 'instagram': return <Instagram className="h-4 w-4 text-[#E4405F]" />;
      case 'threads': return <AtSign className="h-4 w-4 text-[#000000]" />;
      case 'tiktok': return <Music className="h-4 w-4 text-[#010101]" />;
      default: return <Share2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const platformLabels: Record<string, string> = {
    twitter: "X (Twitter)",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    instagram: "Instagram",
    threads: "Threads",
    tiktok: "TikTok",
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Social Posts</h1>
            <p className="text-muted-foreground mt-1">Schedule and manage your event promotions.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Social Post</DialogTitle>
                <DialogDescription>Schedule a new post for your events.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(["twitter", "linkedin", "facebook", "instagram", "threads", "tiktok"] as const).map((platform) => (
                                <SelectItem key={platform} value={platform}>
                                  <div className="flex items-center">
                                    {getPlatformIcon(platform)}
                                    <span className="ml-2">{platformLabels[platform] ?? platform}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="eventId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related Event (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isEventsLoading ? "Loading..." : "None"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {events?.map((event) => (
                                <SelectItem key={event.id} value={event.id.toString()}>
                                  {event.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Post Content</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What's happening?" 
                            className="min-h-[100px] resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Keep it engaging!</span>
                          <span className={field.value.length > 280 ? "text-destructive font-medium" : ""}>
                            {field.value.length}/280
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Schedule For (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Post immediately</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Leave blank to post right now</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-end gap-3 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPost.isPending} className="bg-primary text-primary-foreground">
                      {createPost.isPending ? "Scheduling..." : "Schedule Post"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search posts..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            <Badge variant="secondary" className="px-3 py-1 cursor-pointer bg-primary/10 text-primary border-primary/20 whitespace-nowrap">All</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Scheduled</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Published</Badge>
            <Badge variant="outline" className="px-3 py-1 cursor-pointer whitespace-nowrap">Drafts</Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          ) : filteredPosts?.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-card rounded-xl border border-dashed">
              <Share2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-medium">No posts found</h3>
              <p className="text-muted-foreground mb-4">Start promoting your events across social media.</p>
              <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Create Post</Button>
            </div>
          ) : (
            filteredPosts?.map((post) => (
              <div key={post.id} className="rounded-xl border bg-card text-card-foreground shadow-sm hover-elevate transition-all flex flex-col group relative">
                <div className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-muted/50">
                        {getPlatformIcon(post.platform)}
                      </div>
                      <span className="font-medium text-sm">{platformLabels[post.platform] ?? post.platform}</span>
                    </div>
                    <Badge variant="outline" className={`capitalize text-[10px] ${
                      post.status === 'published' ? 'bg-green-500/10 text-green-700 border-green-500/20' : 
                      post.status === 'scheduled' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' : ''
                    }`}>
                      {post.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap mb-4 flex-1">
                    {post.content}
                  </p>
                  
                  {post.imageUrl && (
                    <div className="h-32 w-full rounded-lg overflow-hidden mb-4 bg-muted">
                      <img src={post.imageUrl} alt="Post attachment" className="w-full h-full object-cover" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t mt-auto">
                    <div className="flex items-center">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {post.scheduledAt ? `Scheduled: ${format(parseISO(post.scheduledAt), "MMM d, h:mm a")}` : 
                       post.publishedAt ? `Published: ${format(parseISO(post.publishedAt), "MMM d, yyyy")}` : 
                       'Draft'}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit Post</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => setPostToDelete(post.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the social media post. This action cannot be undone.
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
