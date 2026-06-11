"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/types";

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isMounted = true;

    async function getInitialUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (isMounted) setUser(session.user);
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (isMounted) setProfile(profile);
        }
      } catch (err) {
        console.error("Error in useUser getInitialUser:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    getInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        try {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (isMounted) setProfile(profile);
        } catch (err) {
          console.error("Error fetching profile on auth change:", err);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Fallback for backwards compatibility if a component uses useUser outside a provider
    // though ideally all components should be wrapped in UserProvider
    return { user: null, profile: null, loading: true };
  }
  return context;
}
