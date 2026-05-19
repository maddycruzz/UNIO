"use client";

import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
