import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Users, Mail, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useListTeamMembers, useInviteTeamMember, useRemoveTeamMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Profile() {
  const { user, activeOrgId, orgs } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Profile state
  const [name, setName] = useState(user?.username ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Team invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "member">("member");
  const inviteTeamMember = useInviteTeamMember();
  const removeTeamMember = useRemoveTeamMember();
  const { data: teamMembers } = useListTeamMembers(activeOrgId);

  const onSaveProfile = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast({ title: "Name must be at least 2 characters", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        toast({ title: "Profile updated!" });
        queryClient.invalidateQueries({ queryKey: ["auth_status"] });
      } else {
        const data = await res.json();
        toast({ title: "Failed to update profile", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    if (!currentPassword) {
      toast({ title: "Enter your current password", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast({ title: "Password changed!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast({ title: "Failed to change password", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const onInviteMember = () => {
    if (!inviteEmail.includes("@") || !inviteName.trim()) {
      toast({ title: "Name and valid email required", variant: "destructive" });
      return;
    }
    inviteTeamMember.mutate(
      { orgId: activeOrgId, data: { email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole } },
      {
        onSuccess: () => {
          toast({ title: "Invitation sent!" });
          setInviteEmail("");
          setInviteName("");
          setInviteRole("member");
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${activeOrgId}/team`] });
        },
        onError: (err) => toast({ title: "Failed to invite", description: err.message, variant: "destructive" }),
      },
    );
  };

  const onRemoveMember = (memberId: number) => {
    removeTeamMember.mutate(
      { orgId: activeOrgId, memberId },
      {
        onSuccess: () => {
          toast({ title: "Team member removed" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${activeOrgId}/team`] });
        },
        onError: (err) => toast({ title: "Failed to remove", description: err.message, variant: "destructive" }),
      },
    );
  };

  const currentOrg = orgs.find((o) => o.id === activeOrgId);
  const roleStyles: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700 border-purple-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    manager: "bg-amber-100 text-amber-700 border-amber-200",
    member: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-muted-foreground mt-1">Manage your profile, password, and team.</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profile</CardTitle>
            <CardDescription>Update your display name and email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input value={user?.email ?? ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Display Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <Button onClick={onSaveProfile} disabled={savingProfile} className="bg-primary text-white">
              {savingProfile ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Change Password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Current Password</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Confirm New Password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={onChangePassword} disabled={savingPassword} variant="outline">
              {savingPassword ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Changing...</> : "Change Password"}
            </Button>
          </CardContent>
        </Card>

        {/* Team Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Team — {currentOrg?.name ?? "Organization"}</CardTitle>
            <CardDescription>Invite members to collaborate on events and campaigns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Invite form */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-sm font-semibold">Invite a team member</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <Input placeholder="Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                <Input placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "manager" | "member")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button onClick={onInviteMember} disabled={inviteTeamMember.isPending} size="sm">
                <Mail className="h-4 w-4 mr-2" />
                {inviteTeamMember.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>

            {/* Members list */}
            {(teamMembers?.length ?? 0) > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-4 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground">
                  {teamMembers!.length} member{teamMembers!.length !== 1 ? "s" : ""}
                </div>
                <div className="divide-y">
                  {teamMembers!.map((m) => (
                    <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${roleStyles[m.role] ?? ""}`}>
                          {m.role === "owner" && <Shield className="h-3 w-3 mr-1" />}
                          {m.role}
                        </Badge>
                        {m.status === "invited" && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">pending</Badge>
                        )}
                        {m.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7 px-2"
                            onClick={() => onRemoveMember(m.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
