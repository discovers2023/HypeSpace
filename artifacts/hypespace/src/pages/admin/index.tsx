import { useAuth } from "@/components/auth-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { startImpersonation, stopImpersonation, impersonation, user } = useAuth();
  const [targetOrgId, setTargetOrgId] = useState("");
  const [, setLocation] = useLocation();

  // In a real application, you would protect this route by verifying
  // `user?.isSuperAdmin` or checking their email against a whitelist.
  
  const handleImpersonate = () => {
    const id = parseInt(targetOrgId);
    if (!isNaN(id)) {
      startImpersonation(id);
      setLocation("/dashboard");
    }
  };

  const handleStopImpersonating = () => {
    stopImpersonation();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Troubleshooting (Impersonation)</CardTitle>
              <CardDescription>
                Securely log into any client's organization by their Organization ID to troubleshoot issues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {impersonation.isImpersonating ? (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-500/10 border border-orange-500 text-orange-500 rounded-lg">
                    <p className="font-semibold">You are currently impersonating an organization.</p>
                    <p className="text-sm mt-1">Actions taken will affect the impersonated client's account.</p>
                  </div>
                  <Button variant="destructive" onClick={handleStopImpersonating}>
                    Stop Impersonating
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Organization ID</label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 2" 
                      value={targetOrgId} 
                      onChange={(e) => setTargetOrgId(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleImpersonate} disabled={!targetOrgId}>
                    Impersonate Organization
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
