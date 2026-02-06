import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

export function useLoginGate() {
  const { isAuthenticated } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const gate = useCallback((): boolean => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return false;
    }
    return true;
  }, [isAuthenticated]);

  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);

  return { gate, showLoginModal, closeLoginModal, isAuthenticated };
}
