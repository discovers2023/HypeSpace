import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
const BASE = "";

type User = {
  id: number;
  email: string;
  username: string;
};

type OrgSummary = { id: number; name: string; slug: string };

type ImpersonationState = {
  isImpersonating: boolean;
  originalOrgId: number | null;
};

type AuthContextType = {
  user: User | null;
  orgs: OrgSummary[];
  activeOrgId: number;
  onboardingCompletedAt: string | null;
  impersonation: ImpersonationState;
  isLoading: boolean;
  login: (user: User, orgs: OrgSummary[], activeOrgId: number) => void;
  logout: () => void;
  switchOrg: (orgId: number) => void;
  startImpersonation: (targetOrgId: number) => void;
  stopImpersonation: () => void;
  refreshOnboarding: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);

  // 0 signals "not yet loaded" — consumers will wait for a real value
  const [activeOrgId, setActiveOrgId] = useState<number>(0);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    isImpersonating: false,
    originalOrgId: null,
  });

  const { data: authData, isLoading } = useQuery({
    queryKey: ["auth_status"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    // Prevent retries on 401s
    retry: false,
  });

  useEffect(() => {
    if (authData) {
      setUser({ id: authData.id, email: authData.email, username: authData.name });
      setOrgs(authData.orgs ?? []);
      if (!impersonation.isImpersonating) {
        setActiveOrgId(authData.activeOrgId ?? 0);
      }
      setOnboardingCompletedAt(authData.onboardingCompletedAt ?? null);
      // Store CSRF token if returned
      if (authData.csrfToken) {
        (window as Window & { __csrfToken?: string }).__csrfToken = authData.csrfToken;
      }
    } else {
      setUser(null);
      setOrgs([]);
      setOnboardingCompletedAt(null);
    }
  }, [authData, impersonation.isImpersonating]);

  const refreshOnboarding = () => {
    queryClient.invalidateQueries({ queryKey: ["auth_status"] });
  };

  const login = (newUser: User, newOrgs: OrgSummary[], newActiveOrgId: number) => {
    setUser(newUser);
    setOrgs(newOrgs);
    setActiveOrgId(newActiveOrgId);
    queryClient.invalidateQueries();
  };

  const logout = () => {
    setUser(null);
    setOrgs([]);
    setImpersonation({ isImpersonating: false, originalOrgId: null });
    queryClient.clear();
  };

  const switchOrg = (orgId: number) => {
    setActiveOrgId(orgId);
    queryClient.clear();
  };

  const startImpersonation = (targetOrgId: number) => {
    if (!user) return; // Must be logged in

    setImpersonation({
      isImpersonating: true,
      originalOrgId: activeOrgId,
    });
    setActiveOrgId(targetOrgId);

    // Clear all queries since we are shifting contexts
    queryClient.clear();
  };

  const stopImpersonation = () => {
    if (!impersonation.isImpersonating || !impersonation.originalOrgId) return;

    setActiveOrgId(impersonation.originalOrgId);
    setImpersonation({
      isImpersonating: false,
      originalOrgId: null,
    });

    // Clear all queries to refetch your original data
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        orgs,
        activeOrgId,
        onboardingCompletedAt,
        impersonation,
        isLoading,
        login,
        logout,
        switchOrg,
        startImpersonation,
        stopImpersonation,
        refreshOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
