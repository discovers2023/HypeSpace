import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { impersonation, stopImpersonation, activeOrgId } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        {impersonation.isImpersonating && (
          <div className="bg-orange-600 text-white p-2 px-4 flex justify-between items-center text-sm font-medium z-50">
            <span>🛡️ You are currently impersonating Organization ID: {activeOrgId}</span>
            <Button size="sm" variant="secondary" onClick={stopImpersonation} className="h-7 text-xs">
              Stop Impersonating
            </Button>
          </div>
        )}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
