"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AuthModal } from "./AuthModal";

export type AuthModalMode = "signin" | "signup" | "reset";

interface AuthModalContextValue {
  open: (mode?: AuthModalMode) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("signin");

  const open = useCallback((next: AuthModalMode = "signin") => {
    setMode(next);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<AuthModalContextValue>(() => ({ open, close }), [open, close]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={isOpen} mode={mode} onModeChange={setMode} onClose={close} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    // Provider が無い場合でも no-op で動作させる（テストや非ロケールページ用）
    return { open: () => {}, close: () => {} };
  }
  return ctx;
}
