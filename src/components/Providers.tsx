"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { usePageView } from "@/lib/usePageView";
import { ReactNode, useEffect, useState } from "react";

function Analytics() {
  usePageView();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show a consistent loading state on both server and client initial render
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Analytics />
      {children}
    </AuthProvider>
  );
}
