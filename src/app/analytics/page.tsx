"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface AnalyticsData {
  totalViews: number;
  uniqueUsers: number;
  days: number;
  byPage: Record<string, number>;
  byCountry: Record<string, number>;
  byBrowser: Record<string, number>;
  byType: Record<string, number>;
  byUser: Record<string, { email: string | null; views: number; clicks: number }>;
  byUserPage: { email: string | null; page: string; count: number }[];
  recentEvents: Record<string, unknown>[];
}

function sortedEntries(obj: Record<string, number>): [string, number][] {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function BreakdownTable({ title, data }: { title: string; data: [string, number][] }) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {data.map(([key, count]) => (
          <div key={key} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-gray-700 truncate">{key}</span>
            <span className="text-sm font-semibold text-gray-900 ml-4 shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [days, setDays] = useState(7);
  const REFRESH_SECONDS = 5 * 60;
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);
  const secondsRef = useRef(REFRESH_SECONDS);

  const fetchData = async (email: string, numDays: number) => {
    setFetching(true);
    setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`/api/analytics?email=${encodeURIComponent(email)}&days=${numDays}&limit=500`, {
        signal: controller.signal,
      });
      if (res.status === 403) {
        setError("Access denied — your account is not authorized to view analytics.");
        setData(null);
      } else if (!res.ok) {
        setError("Failed to load analytics.");
      } else {
        setData(await res.json());
      }
    } catch {
      setError("Failed to connect to analytics API — request timed out.");
    } finally {
      clearTimeout(timeout);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && user?.email) {
      fetchData(user.email, days);
    }
  }, [user, loading, days]);

  // Countdown timer with auto-refresh every 5 minutes
  useEffect(() => {
    if (!user?.email) return;
    secondsRef.current = REFRESH_SECONDS;
    setSecondsLeft(REFRESH_SECONDS);
    const tick = setInterval(() => {
      secondsRef.current -= 1;
      setSecondsLeft(secondsRef.current);
      if (secondsRef.current <= 0) {
        fetchData(user.email!, days);
        secondsRef.current = REFRESH_SECONDS;
        setSecondsLeft(REFRESH_SECONDS);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [user?.email, days]);

  // Not signed in — show login
  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-600 mb-6">Sign in to view site analytics. Admin access only.</p>
          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Access denied
  if (error && !fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-5xl">🚫</div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-green-700 px-6 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const userEntries = Object.entries(data.byUser).sort((a, b) => (b[1].views + b[1].clicks) - (a[1].views + a[1].clicks));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">📊 Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Last {data.days} days</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    days === d ? "bg-green-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              Auto-refresh in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
          <StatCard label="Total Events" value={data.totalViews} />
          <StatCard label="Unique Users" value={data.uniqueUsers} />
          <StatCard label="Page Views" value={data.byType?.page_view || 0} />
          <StatCard label="Clicks" value={data.byType?.click || 0} />
        </div>

        {/* Breakdowns */}
        <div className="grid gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-3">
          <BreakdownTable title="By Page" data={sortedEntries(data.byPage)} />
          <BreakdownTable title="By Country" data={sortedEntries(data.byCountry)} />
          <BreakdownTable title="By Browser" data={sortedEntries(data.byBrowser)} />
        </div>

        {/* Per-user breakdown */}
        {userEntries.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">By User</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-500">Email</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Views</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Clicks</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userEntries.map(([uid, info]) => (
                    <tr key={uid}>
                      <td className="px-4 py-2.5 text-gray-700">{info.email || uid}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{info.views}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{info.clicks}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{info.views + info.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User × Page breakdown */}
        {data.byUserPage && data.byUserPage.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">User × Page Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-500">User</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Page</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Visits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byUserPage.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 text-gray-700">{row.email || "Anonymous"}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{row.page}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
