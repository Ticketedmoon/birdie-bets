"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { createParty, addInvites } from "@/lib/firestore";
import { fetchCurrentTournaments } from "@/lib/espn";
import type { Tournament } from "@/types";

function CreatePartyContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [emails, setEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCurrentTournaments()
      .then((t) => {
        setTournaments(t);
        if (t.length > 0) setSelectedTournament(t[0].id);
      })
      .catch(() => setError("Failed to load tournaments"))
      .finally(() => setLoadingTournaments(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTournament || !name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const tournament = tournaments.find((t) => t.id === selectedTournament);
      if (!tournament) throw new Error("Tournament not found");

      const party = await createParty(
        name.trim(),
        user.uid,
        tournament.id,
        tournament.name,
        tournament.startDate
      );

      // Add email invites to Firestore + send actual emails
      const emailList = emails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (emailList.length > 0) {
        await addInvites(party.id, emailList, user.uid);

        // Send invite emails — wait for result to show feedback
        try {
          const emailRes = await fetch("/api/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              emails: emailList,
              partyName: name.trim(),
              inviteCode: party.inviteCode,
              invitedBy: user.displayName || user.email || "Someone",
            }),
          });
          const emailData = await emailRes.json();
          if (emailData.sent > 0) {
            // Store result to show on party page via query param
            router.push(`/party/${party.id}?emailsSent=${emailData.sent}&emailsFailed=${emailData.failed || 0}`);
            return;
          }
        } catch {
          // Email sending failed but party was created — continue
        }
      }

      router.push(`/party/${party.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create party");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:mb-10 sm:text-3xl">Create a Party</h1>

      <form onSubmit={handleSubmit} className="w-full space-y-6 sm:space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Party Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., The Masters 2026 Crew"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tournament
          </label>
          {loadingTournaments ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-600"></div>
              Loading tournaments...
            </div>
          ) : (
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
              required
            >
              {tournaments.map((t) => {
                const date = new Date(t.startDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} — {date}
                    {t.isMajor ? " ⭐ Major" : ""}
                    {t.status === "in" ? " 🔴 LIVE" : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invite Friends (optional)
          </label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Enter email addresses, separated by commas or new lines"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
            rows={3}
          />
          <p className="mt-2 text-xs leading-5 text-gray-400 sm:text-sm">
            Separate emails with commas or new lines.
            Invitees will see the party when they sign in with the same email.
            You can also share the invite code after creation.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim() || !selectedTournament}
          className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create Party"}
        </button>
      </form>
    </div>
  );
}

export default function CreatePartyPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <CreatePartyContent />
    </ProtectedRoute>
  );
}
