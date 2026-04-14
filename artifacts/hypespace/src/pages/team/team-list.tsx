import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { useListTeamMembers, useInviteTeamMember, useUpdateTeamMember } from "@workspace/api-client-react";
import { Users, Plus, Search, MoreHorizontal, Shield, Mail, User, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
const inviteSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "manager", "member"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function TeamList() {
  const { data: members, isLoading } = useListTeamMembers(1);
  const inviteMember = useInviteTeamMember();
  const updateMember = useUpdateTeamMember();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "member",
    },
  });

  const filteredMembers = members?.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = (data: InviteFormValues) => {
    inviteMember.mutate(
      {
        orgId: 1,
        data: {
          name: data.name,
          email: data.email,
          role: data.role,
        } as any
      },
      {
        onSuccess: (result: any) => {
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", 1, "team"] });
          setIsInviteOpen(false);
          form.reset();
          if (result?.inviteLink) {
            toast({
              title: `Invitation sent to ${data.email}`,
              description: (
                <span className="text-xs">
                  An invite email is on its way.{" "}
                  <a
                    href={result.inviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Copy invite link
                  </a>
                </span>
              ) as any,
              duration: 8000,
            });
          } else {
            toast({ title: "Team member invited successfully" });
          }
        },
        onError: (err) => {
          toast({ 
            title: "Failed to invite member", 
            description: err.message, 
            variant: "destructive" 
          });
        }
      }
    );
  };

  const handleRoleChange = (memberId: number, role: string) => {
    updateMember.mutate(
      {
        orgId: 1,
        memberId,
        data: { role }
      },
      {
        onSuccess: () => {
          toast({ title: "Role updated successfully" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", 1, "team"] });
        },
        onError: (err) => {
          toast({ 
            title: "Failed to update role", 
            description: err.message, 
            variant: "destructive" 
          });
        }
      }
    );
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <ShieldAlert className="h-4 w-4 text-destructive" />;
      case 'admin': return <Shield className="h-4 w-4 text-primary" />;
      case 'manager': return <Users className="h-4 w-4 text-accent" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your team members and their roles.</p>
          </div>
          
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
                <Plus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>Add a new member to your organization.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="jane@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Admins have full access. Managers can manage events. Members can only view.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteMember.isPending} className="bg-primary text-primary-foreground">
                      {inviteMember.isPending ? "Sending..." : "Send Invitation"}
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
              placeholder="Search team members..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground font-medium">
            {members?.length || 0} members total
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredMembers?.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto opacity-20 mb-3" />
              <p>No team members found.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMembers?.map((member) => (
                <div key={member.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      {member.status === 'invited' && (
                        <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                          Pending Invite
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center truncate">
                        <Mail className="h-3 w-3 mr-1 shrink-0" />
                        {member.email}
                      </span>
                      <span className="flex items-center capitalize">
                        {getRoleIcon(member.role)}
                        <span className="ml-1">{member.role}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8">
                          Manage
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Member Role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup 
                          value={member.role} 
                          onValueChange={(val) => handleRoleChange(member.id, val)}
                        >
                          <DropdownMenuRadioItem value="admin" disabled={member.role === 'owner'}>
                            <div className="flex flex-col">
                              <span>Admin</span>
                              <span className="text-[10px] text-muted-foreground">Full access</span>
                            </div>
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="manager" disabled={member.role === 'owner'}>
                            <div className="flex flex-col">
                              <span>Manager</span>
                              <span className="text-[10px] text-muted-foreground">Manage events</span>
                            </div>
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="member" disabled={member.role === 'owner'}>
                            <div className="flex flex-col">
                              <span>Member</span>
                              <span className="text-[10px] text-muted-foreground">View only</span>
                            </div>
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        {member.role !== 'owner' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                              Remove Member
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
