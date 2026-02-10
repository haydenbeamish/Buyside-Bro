import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const [viewAs, setViewAs] = useState(() => localStorage.getItem("admin_view_as"));

  useEffect(() => {
    const onStorage = () => setViewAs(localStorage.getItem("admin_view_as"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (viewAs === "logged_out") {
    return { user: null, isLoading: false, isAuthenticated: false };
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
