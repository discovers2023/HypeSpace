import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAiGenerateCampaign, useListEvents, useCreateCampaign, useGetOrganization } from "@workspace/api-client-react";
import { ArrowLeft, Sparkles, Wand2, Mail } from "lucide-react";
import { CampaignSuggestionList } from "@/components/campaign-suggestion-list";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
const aiCampaignSchema = z.object({
  eventId: z.string().min(1, "Please select an event"),
  campaignType: z.enum(["invitation", "reminder", "followup", "announcement", "custom"]),
  tone: z.enum(["professional", "friendly", "formal", "casual", "urgent"]),
  additionalContext: z.string().optional(),
});

type AiCampaignFormValues = z.infer<typeof aiCampaignSchema>;

function applyBranding(html: string, branding: { primaryColor?: string | null; accentColor?: string | null; name: string; logoUrl?: string | null; emailFooterText?: string | null; fromEmail?: string | null }) {
  let out = html;
  const primary = branding.primaryColor || "#7C3AED";
  const accent = branding.accentColor || "#EA580C";

  out = out.replace(/#7C3AED/g, primary).replace(/#EA580C/g, accent);
  out = out.replace(/HypeSpace Events/g, branding.name);
  out = out.replace(/Where moments are made/g, branding.fromEmail ? `Sent by ${branding.fromEmail}` : "Where moments are made");

  if (branding.logoUrl) {
    out = out.replace(
      /<h1 style[^>]*>.*?<\/h1>/,
      `<img src="${branding.logoUrl}" alt="${branding.name}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:8px;" />`
    );
  }

  if (branding.emailFooterText) {
    out = out.replace(
      /You're receiving this email because you're on our guest list\./,
      branding.emailFooterText
    );
  }

  return out;
}

export default function CampaignAi() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const generateCampaign = useAiGenerateCampaign();
  const createCampaign = useCreateCampaign();
  const { data: events, isLoading: isEventsLoading } = useListEvents(1);
  const { data: org } = useGetOrganization(1);
  
  const [generatedResult, setGeneratedResult] = useState<{
    subject: string;
    htmlContent: string;
    textContent: string;
    suggestions: string[];
    selectedEventId: number;
    selectedType: string;
  } | null>(null);

  const form = useForm<AiCampaignFormValues>({
    resolver: zodResolver(aiCampaignSchema),
    defaultValues: {
      eventId: "",
      campaignType: "invitation",
      tone: "professional",
      additionalContext: "",
    },
  });

  const onSubmit = async (data: AiCampaignFormValues) => {
    generateCampaign.mutate(
      { 
        data: {
          eventId: parseInt(data.eventId, 10),
          campaignType: data.campaignType,
          tone: data.tone,
          additionalContext: data.additionalContext
        }
      },
      {
        onSuccess: (result) => {
          toast({ title: "Campaign generated successfully!" });
          const branding = org ? {
            primaryColor: org.primaryColor,
            accentColor: org.accentColor,
            name: org.name,
            logoUrl: org.logoUrl,
            emailFooterText: org.emailFooterText,
            fromEmail: org.fromEmail,
          } : { name: "HypeSpace Events" };
          setGeneratedResult({
            ...result,
            htmlContent: applyBranding(result.htmlContent, branding),
            selectedEventId: parseInt(data.eventId, 10),
            selectedType: data.campaignType
          });
        },
        onError: (error) => {
          toast({
            title: "Generation failed",
            description: error.message || "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSaveDraft = () => {
    if (!generatedResult) return;
    
    createCampaign.mutate(
      {
        orgId: 1,
        data: {
          eventId: generatedResult.selectedEventId,
          name: `AI Generated: ${generatedResult.subject.substring(0, 30)}...`,
          subject: generatedResult.subject,
          type: generatedResult.selectedType,
          htmlContent: generatedResult.htmlContent,
          textContent: generatedResult.textContent,
        }
      },
      {
        onSuccess: (created) => {
          toast({
            title: "Draft saved",
            description: "Now refine the content before sending.",
          });
          // Land in the editor instead of the list — users almost always
          // want to tweak subject/copy right after AI generation.
          if (created?.id) {
            setLocation(`/campaigns/${created.id}/edit`);
          } else {
            setLocation("/campaigns");
          }
        },
        onError: (err) => {
          toast({
            title: "Failed to save draft",
            description: err.message,
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-12">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              AI Campaign Generator
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Beta</Badge>
            </h1>
            <p className="text-muted-foreground mt-1">Let our AI craft the perfect email for your event.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-primary/20 shadow-md shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  Campaign Brief
                </CardTitle>
                <CardDescription>Tell us what you need and we'll write it.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="eventId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Event</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isEventsLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isEventsLoading ? "Loading events..." : "Select an event"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="campaignType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Campaign Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(["invitation", "reminder", "followup", "announcement", "custom"] as const).map((type) => (
                                  <SelectItem key={type} value={type} className="capitalize">
                                    {type}
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
                        name="tone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tone of Voice</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select tone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(["professional", "friendly", "formal", "casual", "urgent"] as const).map((tone) => (
                                  <SelectItem key={tone} value={tone} className="capitalize">
                                    {tone}
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
                      name="additionalContext"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Context (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="e.g. Mention that there will be a surprise guest speaker, and parking is validated." 
                              className="resize-none min-h-[100px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Any specific details you want included.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0" 
                      disabled={generateCampaign.isPending}
                    >
                      {generateCampaign.isPending ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Campaign
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-7">
            {generatedResult ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card>
                  <CardHeader className="bg-muted/30 border-b pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        <Sparkles className="h-3 w-3 mr-1" /> AI Generated
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setGeneratedResult(null)}>
                          Discard
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={handleSaveDraft}
                          disabled={createCampaign.isPending}
                        >
                          {createCampaign.isPending ? "Saving..." : "Save as Draft"}
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">Subject Line</div>
                    <CardTitle className="text-xl">{generatedResult.subject}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="bg-card p-6 min-h-[300px] border-b">
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted"
                        dangerouslySetInnerHTML={{ __html: generatedResult.htmlContent }}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30 flex flex-col items-start p-6">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Suggestions — click to apply
                    </h4>
                    <div className="w-full">
                      <CampaignSuggestionList
                        suggestions={generatedResult.suggestions}
                        html={generatedResult.htmlContent}
                        onApply={(newHtml) =>
                          setGeneratedResult((prev) => prev ? { ...prev, htmlContent: newHtml } : prev)
                        }
                      />
                    </div>
                  </CardFooter>
                </Card>
              </div>
            ) : (
              <div className="h-full min-h-[400px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/10">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-primary opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Ready to generate</h3>
                <p className="max-w-md mx-auto">Fill out the brief on the left and our AI will generate a high-converting email campaign tailored to your event and audience.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
