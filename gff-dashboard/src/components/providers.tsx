"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        theme="dark"
        richColors
        closeButton
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "border border-card-border bg-card text-foreground",
          },
        }}
      />
    </SessionProvider>
  );
}
