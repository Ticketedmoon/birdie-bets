"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 sm:h-16 sm:min-h-0 sm:flex-nowrap sm:py-0">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 text-base font-extrabold tracking-tight sm:text-xl" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
            <span className="shrink-0">⛳</span>
            <span className="truncate">BirdieBets</span>
          </Link>
          {user && (
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-5">
              <span className="hidden text-xs text-green-200 sm:inline sm:text-sm">
                {user.displayName}
              </span>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full ring-2 ring-green-600"
                  referrerPolicy="no-referrer"
                />
              )}
              <button
                onClick={signOut}
                className="rounded-lg bg-green-700 px-3 py-2.5 text-xs transition-colors hover:bg-green-600 sm:px-4 sm:py-2 sm:text-sm"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
