"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPartiesForUser } from "@/lib/firestore";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";
import type { Party } from "@/types";

function statusBadge(status: Party["status"]) {
  const styles = {
    picking: "bg-yellow-100 text-yellow-800",
    locked: "bg-blue-100 text-blue-800",
    complete: "bg-green-100 text-green-800",
  };
  const labels = {
    picking: "Picking Players",
    locked: "Tournament Live",
    complete: "Complete",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PartyCard({ party }: { party: Party }) {
  return (
    <Link
      href={`/party/${party.id}`}
      className="group block rounded-xl border border-gray-200 bg-white px-4 py-4 transition-all hover:border-gray-300 hover:shadow-md sm:px-6 sm:py-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h3 className="text-base font-semibold text-gray-900 truncate">{party.name}</h3>
            {statusBadge(party.status)}
          </div>
          <p className="text-sm text-gray-500">
            {party.tournamentName} &middot; {party.memberUids.length} member
            {party.memberUids.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="self-end text-lg text-gray-300 transition-colors group-hover:text-gray-500 sm:self-auto">→</span>
      </div>
    </Link>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getPartiesForUser(user.uid).then((p) => {
      // Sort newest first
      p.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setParties(p);
      setLoading(false);
    });
  }, [user]);

  // Split into active (picking/locked) and past (complete) parties
  const activeParties = parties.filter((p) => p.status === "picking" || p.status === "locked");
  const pastParties = parties.filter((p) => p.status === "complete");

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Welcome header */}
      <div className="mb-8 sm:mb-12">
        <p className="text-sm font-medium text-green-700 mb-1">Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}</p>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 sm:text-3xl">My Parties</h1>
      </div>

      {/* Action buttons */}
      <div className="mb-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/party/create"
          className="w-full rounded-lg bg-green-700 px-5 py-2.5 text-center font-medium text-white shadow-sm transition-colors hover:bg-green-600 sm:w-auto"
        >
          + Create Party
        </Link>
        <Link
          href="/party/join"
          className="w-full rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 sm:w-auto"
        >
          Join Party
        </Link>
      </div>

      {parties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center sm:py-20">
          <div className="text-6xl mb-5">🏌️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No parties yet</h2>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
            Create a party to start picking golfers, or join one with an invite code.
          </p>
          <Link
            href="/party/create"
            className="inline-block bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm"
          >
            Create Your First Party
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active / Ongoing */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              🟢 Active &amp; Upcoming
            </h2>
            {activeParties.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl px-6 py-8 text-center">
                No active parties — create one for the next tournament!
              </p>
            ) : (
              <div className="space-y-3">
                {activeParties.map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))}
              </div>
            )}
          </section>

          {/* Past / Completed */}
          {pastParties.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                📋 Past Tournaments
              </h2>
              <div className="space-y-3">
                {pastParties.map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <DashboardContent />
    </ProtectedRoute>
  );
}
