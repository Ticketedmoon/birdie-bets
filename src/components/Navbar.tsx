"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
            <span>⛳</span>
            <span>BirdieBets</span>
          </Link>
          {user && (
            <div className="flex items-center gap-2 sm:gap-5">
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
                className="rounded-lg bg-green-700 px-3 py-2 text-xs transition-colors hover:bg-green-600 sm:px-4 sm:py-2 sm:text-sm"
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
