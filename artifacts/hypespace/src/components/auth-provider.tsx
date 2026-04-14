import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
const BASE = "";

type User = {
  id: number;
  email: string;
  username: string;
};

type ImpersonationState = {
  isImpersonating: boolean;
  originalOrgId: number | null;
};

type AuthContextType = {
  user: User | null;
  activeOrgId: number;
  impersonation: ImpersonationState;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  startImpersonation: (targetOrgId: number) => void;
  stopImpersonation: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  
  // Defaulting to 1 to match existing hardcoded pattern before proper login flow is ready
  const [activeOrgId, setActiveOrgId] = useState<number>(1);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    isImpersonating: false,
    originalOrgId: null,
  });

  // Mocking auth check for resolving the UI while api-server is down securely
  const { data: authData, isLoading } = useQuery({
    queryKey: ["auth_status"],
    queryFn: async () => {
      try {
        const res = await fetch(`${BASE}/api/user`);
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      } catch (e) {
        return null;
      }
    },
    // Prevent retries on 401s
    retry: false,
  });

  useEffect(() => {
    if (authData?.user) {
      setUser(authData.user);
      // In a real app we would get the orgId from the user's default organization
      if (!impersonation.isImpersonating) {
        setActiveOrgId(authData.user.defaultOrgId || 1);
      }
    }
  }, [authData, impersonation.isImpersonating]);

  const login = (newUser: User) => {
    setUser(newUser);
    // Again, defaulting to 1 unless the user has a designated defaultOrgId
    setActiveOrgId(1);
    queryClient.invalidateQueries();
  };

  const logout = () => {
    setUser(null);
    setImpersonation({ isImpersonating: false, originalOrgId: null });
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
        activeOrgId,
        impersonation,
        isLoading,
        login,
        logout,
        startImpersonation,
        stopImpersonation,
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
