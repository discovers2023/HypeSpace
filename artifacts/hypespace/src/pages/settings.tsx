import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetOrganization, useUpdateOrganization } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building, CreditCard, Link as LinkIcon, Settings as SettingsIcon } from "lucide-react";
import { useEffect } from "react";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  description: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export default function Settings() {
  const orgId = 1; // Hardcoded default
  const { data: org, isLoading } = useGetOrganization(orgId);
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: "",
      description: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    if (org) {
      form.reset({
        name: org.name,
        description: org.description || "",
        logoUrl: org.logoUrl || "",
      });
    }
  }, [org, form]);

  const onSubmit = (data: OrgFormValues) => {
    updateOrg.mutate(
      {
        orgId,
        data,
      },
      {
        onSuccess: () => {
          toast({ title: "Settings updated successfully" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId] });
        },
        onError: (err) => {
          toast({ 
            title: "Failed to update settings", 
            description: err.message, 
            variant: "destructive" 
          });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your organization preferences and billing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="justify-start">
              <Building className="mr-2 h-4 w-4" />
              General
            </Button>
            <Button variant="ghost" className="justify-start text-muted-foreground">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing & Plan
            </Button>
            <Button variant="ghost" className="justify-start text-muted-foreground">
              <LinkIcon className="mr-2 h-4 w-4" />
              Integrations
            </Button>
            <Button variant="ghost" className="justify-start text-muted-foreground">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Advanced
            </Button>
          </div>

          <div className="md:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Profile</CardTitle>
                <CardDescription>
                  This is how your organization will appear to your guests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="flex items-center gap-6 mb-6">
                        <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center border">
                          {form.watch("logoUrl") ? (
                            <img src={form.watch("logoUrl")} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Building className="h-8 w-8 text-muted-foreground opacity-50" />
                          )}
                        </div>
                        <div>
                          <FormLabel className="mb-2 block">Organization Logo</FormLabel>
                          <Button type="button" variant="outline" size="sm">Upload new logo</Button>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Tell us about your organization..." 
                                className="resize-none" 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              This will be displayed on your public event pages.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="pt-4 border-t flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={updateOrg.isPending || !form.formState.isDirty}
                          className="bg-primary text-primary-foreground"
                        >
                          {updateOrg.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and limits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg capitalize">{org?.plan} Plan</span>
                        <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {org?.plan === 'free' ? 'Basic features for exploration.' :
                         org?.plan === 'starter' ? 'Perfect for growing communities.' :
                         org?.plan === 'professional' ? 'Advanced tools for serious organizers.' : 'Enterprise grade features.'}
                      </p>
                    </div>
                    <Button variant="outline" className="mt-4 sm:mt-0">Manage Plan</Button>
                  </div>
                )}

                {!isLoading && org && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Active Events</div>
                      <div className="text-2xl font-bold">{org.eventCount} <span className="text-sm font-normal text-muted-foreground">/ {org.plan === 'free' ? 1 : org.plan === 'starter' ? 5 : '∞'}</span></div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Team Members</div>
                      <div className="text-2xl font-bold">{org.memberCount} <span className="text-sm font-normal text-muted-foreground">/ {org.plan === 'professional' || org.plan === 'enterprise' ? '∞' : 1}</span></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-destructive/20 shadow-none">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Delete Organization</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permanently delete this organization and all its data.
                    </p>
                  </div>
                  <Button variant="destructive">Delete</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
