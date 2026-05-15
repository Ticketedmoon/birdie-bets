"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { LeaderboardCards } from "@/components/party/LeaderboardCards";
import { LeaderboardTable } from "@/components/party/LeaderboardTable";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import {
  AUTO_REFRESH_SECONDS,
  COPY_FEEDBACK_MS,
  COUNTDOWN_TICK_MS,
  EMAIL_BANNER_MS,
  INVITE_RESULT_MS,
} from "@/lib/constants";
import { fetchFirstTeeTime, fetchCurrentRound, fetchLeaderboard } from "@/lib/espn";
import { addInvites, deleteParty, getAllPicksForParty, getParty, getUsersInfo, leaveParty } from "@/lib/firestore";
import { buildLeaderboardEntries } from "@/lib/leaderboard";
import { calculatePayouts } from "@/lib/payouts";
import { syncPartyStatus } from "@/lib/partySync";
import type { LeaderboardEntry, Party, PlayerScore } from "@/types";

function PartyContent() {
  const { partyId } = useParams<{ partyId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [party, setParty] = useState<Party | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [emailBanner, setEmailBanner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tournamentCountdown, setTournamentCountdown] = useState("");
  const [lockTime, setLockTime] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"cards" | "table">("cards");
  const [unlockSending, setUnlockSending] = useState<Record<string, boolean>>({});
  const [unlockResult, setUnlockResult] = useState<Record<string, string>>({});
  const [currentRound, setCurrentRound] = useState<{ currentRound: number; displayRound: number; totalRounds: number; nextRoundTeeTime: string | null } | null>(null);

  // Show email send results from create flow
  useEffect(() => {
    const sent = searchParams.get("emailsSent");
    const failed = searchParams.get("emailsFailed");
    if (sent) {
      const failedCount = parseInt(failed || "0");
      if (failedCount > 0) {
        setEmailBanner(`📧 ${sent} invite(s) sent, ${failedCount} failed`);
      } else {
        setEmailBanner(`📧 ${sent} invite email(s) sent successfully!`);
      }
      setTimeout(() => setEmailBanner(null), EMAIL_BANNER_MS);
    }
  }, [searchParams]);

  const buildLeaderboard = async (partyData: Party) => {
    const [allPicks, usersInfo, scores] = await Promise.all([
      getAllPicksForParty(partyData.id),
      getUsersInfo(partyData.memberUids),
      fetchLeaderboard(partyData.tournamentId).catch(() => [] as PlayerScore[]),
    ]);

    return buildLeaderboardEntries(partyData, allPicks, usersInfo, scores);
  };

  useEffect(() => {
    if (!partyId) return;
    setLoading(true);
    getParty(partyId)
      .then(async (p) => {
        if (!p) {
          setError("Party not found");
          setLoading(false);
          return;
        }
        // Auto-sync party status with live ESPN tournament status
        const synced = await syncPartyStatus(p);
        setParty(synced);
        const lb = await buildLeaderboard(synced);
        setLeaderboard(lb);
        // Fetch current round info when tournament is in progress or complete
        if (synced.status === "locked" || synced.status === "complete") {
          fetchCurrentRound(synced.tournamentId).then(setCurrentRound).catch(() => {});
        }
        setLastRefreshed(new Date());
        setCountdown(AUTO_REFRESH_SECONDS);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [partyId]);

  const handleRefresh = async () => {
    if (!party) return;
    setRefreshing(true);
    try {
      // Re-sync party status on every refresh
      const synced = await syncPartyStatus(party);
      setParty(synced);
      const lb = await buildLeaderboard(synced);
      setLeaderboard(lb);
      if (synced.status === "locked" || synced.status === "complete") {
        fetchCurrentRound(synced.tournamentId).then(setCurrentRound).catch(() => {});
      }
      setLastRefreshed(new Date());
      setCountdown(AUTO_REFRESH_SECONDS);
    } catch (err) {
      setError("Failed to refresh scores");
    }
    setRefreshing(false);
  };

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!party || loading) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger refresh
          handleRefresh();
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [party, loading]);

  // First tee-off countdown — fetches actual tee time from ESPN, falls back to tournament start date
  useEffect(() => {
    if (!party || party.status !== "picking") return;

    let cancelled = false;

    const init = async () => {
      const teeTime = await fetchFirstTeeTime(party.tournamentId);
      if (cancelled) return;

      const teeOff = teeTime
        ? Date.parse(teeTime)
        : new Date(party.tournamentStartDate).getTime();
      setLockTime(teeOff);
    };

    init();
    return () => { cancelled = true; };
  }, [party?.tournamentId, party?.status]);

  useEffect(() => {
    if (!party || party.status !== "picking" || lockTime === null) return;

    const updateCountdown = () => {
      const diff = lockTime - Date.now();

      if (diff <= 0) {
        setTournamentCountdown("");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      setTournamentCountdown(parts.join(" "));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [party?.status, lockTime]);

  const handleCopyInvite = () => {
    if (!party) return;
    const url = `${window.location.origin}/party/join?code=${party.inviteCode}`;
    navigator.clipboard.writeText(url);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), COPY_FEEDBACK_MS);
  };

  const handleInviteMore = async () => {
    if (!party || !user || !inviteEmails.trim()) return;
    setInviteSending(true);
    setInviteResult(null);

    const emailList = inviteEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailList.length === 0) {
      setInviteSending(false);
      return;
    }

    try {
      await addInvites(party.id, emailList, user.uid);

      // Send emails
      const emailRes = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailList,
          partyName: party.name,
          inviteCode: party.inviteCode,
          invitedBy: user.displayName || user.email || "Someone",
        }),
      });
      const emailData = await emailRes.json();
      setInviteResult(`✓ ${emailData.sent || emailList.length} invite(s) sent!`);
      setInviteEmails("");
      setTimeout(() => {
        setInviteResult(null);
        setShowInviteForm(false);
      }, INVITE_RESULT_MS);
    } catch {
      setInviteResult("Failed to send invites — but invite code still works.");
    }
    setInviteSending(false);
  };

  const handleLeaveParty = async () => {
    if (!party || !partyId || !user) return;
    setLeaving(true);
    try {
      await leaveParty(partyId, user.uid);
      router.push("/dashboard");
    } catch {
      setError("Failed to leave party");
      setLeaving(false);
    }
  };

  const handleDeleteParty = async () => {
    if (!party || !partyId) return;
    setDeleting(true);
    try {
      await deleteParty(partyId);
      router.push("/dashboard");
    } catch {
      setError("Failed to delete party");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600">{error || "Party not found"}</p>
      </div>
    );
  }

  const userHasPicks = leaderboard.find((e) => e.uid === user?.uid)?.picks.some(
    (p) => p.playerId
  );
  const isLocked = party.status !== "picking";
  const picksRevealed = isLocked; // picks only visible once tournament starts

  const handleSendUnlock = async (targetUid: string) => {
    if (!user || !party) return;
    setUnlockSending((prev) => ({ ...prev, [targetUid]: true }));
    setUnlockResult((prev) => ({ ...prev, [targetUid]: "" }));
    try {
      const res = await fetch("/api/send-pick-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: party.id, callerUid: user.uid, targetUid }),
      });
      const data = await res.json();
      if (res.ok) {
        setUnlockResult((prev) => ({ ...prev, [targetUid]: `✅ Unlock email sent to ${data.sentTo}` }));
      } else {
        setUnlockResult((prev) => ({ ...prev, [targetUid]: `❌ ${data.error}` }));
      }
    } catch {
      setUnlockResult((prev) => ({ ...prev, [targetUid]: "❌ Failed to send unlock email" }));
    }
    setUnlockSending((prev) => ({ ...prev, [targetUid]: false }));
  };

  return (
    <div className="w-full px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">{party.name}</h1>
          <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
            {party.tournamentName} • {party.memberUids.length} member
            {party.memberUids.length !== 1 ? "s" : ""}
          </p>
          {tournamentCountdown && party.status === "picking" && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-amber-700">
              ⛳ First tee-off in {tournamentCountdown} — picks lock at tee-off
            </p>
          )}
          {!tournamentCountdown && party.status === "picking" && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-blue-700">
              🔒 First tee-off is imminent — picks are about to lock
            </p>
          )}
          {party.buyIn > 0 && (() => {
            const payouts = calculatePayouts(party);
            return (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  💰 €{party.buyIn} buy-in
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                  🏆 1st: €{payouts.first}
                </span>
                {party.secondPlacePayout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                    🥈 2nd: €{payouts.second}
                  </span>
                )}
                {party.thirdPlacePayout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                    🥉 3rd: €{payouts.third}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  Pot: €{payouts.totalPot}
                </span>
              </div>
            );
          })()}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            {showInviteForm ? "✕ Close" : "➕ Invite More"}
          </button>
          {!isLocked && !userHasPicks && (
            <Link
              href={`/party/${party.id}/picks`}
              className="w-full rounded-lg bg-green-700 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-green-600 sm:w-auto"
            >
              🏌️ Pick Players
            </Link>
          )}
          {!isLocked && userHasPicks && (
            <Link
              href={`/party/${party.id}/picks`}
              className="w-full rounded-lg bg-yellow-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-yellow-500 sm:w-auto"
            >
              ✏️ Edit Picks
            </Link>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 sm:w-auto"
          >
            {refreshing ? "Refreshing..." : `🔄 Refresh (${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")})`}
          </button>
        </div>
      </div>

      {currentRound && (party.status === "locked" || party.status === "complete") && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-5 py-2 text-sm sm:text-base font-semibold text-green-800 shadow-sm">
            ⛳ Round {currentRound.displayRound} of {currentRound.totalRounds}
          </span>
          {currentRound.nextRoundTeeTime && party.status === "locked" && new Date(currentRound.nextRoundTeeTime) > new Date() && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-xs sm:text-sm font-medium text-amber-800 shadow-sm">
              🕐 Tee-off: {new Date(currentRound.nextRoundTeeTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
              {new Date(currentRound.nextRoundTeeTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {party.status === "locked" && (!currentRound.nextRoundTeeTime || new Date(currentRound.nextRoundTeeTime) <= new Date()) && (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs sm:text-sm font-semibold text-red-700 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
              </span>
              Round underway
            </span>
          )}
        </div>
      )}

      {showInviteForm && party && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Invite more people</h3>

          {/* Shareable link — primary method */}
          <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Share this link:</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/party/join?code=${party.inviteCode}`}
                className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyInvite}
                className="shrink-0 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {inviteCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Email invites — secondary method */}
          <p className="text-xs font-medium text-gray-500 mb-2">Or send email invites:</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses, separated by commas or new lines"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={2}
            />
            <button
              onClick={handleInviteMore}
              disabled={inviteSending || !inviteEmails.trim()}
              className="shrink-0 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteSending ? "Sending..." : "Send Invites"}
            </button>
          </div>
          {inviteResult && (
            <p className={`text-sm mt-2 ${inviteResult.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
              {inviteResult}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            💡 Tip: Sharing the link directly is the fastest way to invite people.
          </p>
        </div>
      )}

      {lastRefreshed && (
        <p className="text-xs text-gray-400 mb-4">
          Last updated: {lastRefreshed.toLocaleTimeString()} · Auto-refresh in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
        </p>
      )}

      {emailBanner && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="break-words">{emailBanner}</span>
          <button onClick={() => setEmailBanner(null)} className="self-end text-green-600 transition-colors hover:text-green-800 sm:ml-4">✕</button>
        </div>
      )}

      {party.invalidPicks && party.invalidPicks.length > 0 && party.status === "picking" && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Tournament starting — some members have picks not in the confirmed field</p>
          <p className="mt-1 text-xs sm:text-sm text-amber-700">
            The game will lock automatically once all picks are valid. Affected members have been emailed.
          </p>
          <ul className="mt-2 space-y-1 text-xs sm:text-sm">
            {Array.from(new Set(party.invalidPicks.map((ip) => ip.uid))).map((uid) => {
              const memberPicks = party.invalidPicks!.filter((ip) => ip.uid === uid);
              const memberEntry = leaderboard.find((e) => e.uid === uid);
              const memberName = memberEntry?.userName || uid;
              return (
                <li key={uid}>
                  <strong>{memberName}</strong>: {memberPicks.map((ip) => ip.playerName).join(", ")}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isLocked && party.status === "locked" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6 text-sm">
          🔒 Picks are locked — the tournament is in progress.
        </div>
      )}

      {party.status === "complete" && leaderboard.length > 0 && party.buyIn > 0 && (() => {
        const payouts = calculatePayouts(party);
        const winner = leaderboard[0];
        const second = leaderboard[1];
        const third = leaderboard[2];
        return (
          <div className="mb-6 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-yellow-50 p-5">
            <h2 className="text-lg font-bold text-emerald-900 mb-3">🏆 Tournament Complete!</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🥇</span>
                <div>
                  <span className="font-semibold text-gray-900">{winner.userName}</span>
                  <span className="text-gray-500 text-sm ml-2">({winner.displayTotal})</span>
                </div>
                <span className="ml-auto rounded-full bg-emerald-200 px-3 py-1 text-sm font-bold text-emerald-900">
                  Wins €{payouts.first}
                </span>
              </div>
              {party.secondPlacePayout && second && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🥈</span>
                  <div>
                    <span className="font-semibold text-gray-900">{second.userName}</span>
                    <span className="text-gray-500 text-sm ml-2">({second.displayTotal})</span>
                  </div>
                  <span className="ml-auto rounded-full bg-gray-200 px-3 py-1 text-sm font-bold text-gray-700">
                    Wins €{payouts.second}
                  </span>
                </div>
              )}
              {party.thirdPlacePayout && third && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🥉</span>
                  <div>
                    <span className="font-semibold text-gray-900">{third.userName}</span>
                    <span className="text-gray-500 text-sm ml-2">({third.displayTotal})</span>
                  </div>
                  <span className="ml-auto rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                    Gets €{payouts.third} back
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {!picksRevealed && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 text-sm">
          🙈 Picks are hidden until the tournament starts. You can only see your own selections.
        </div>
      )}

      {/* Leaderboard Table */}
      {leaderboard.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">No picks submitted yet. Share the invite code to get started!</p>
        </div>
      ) : (
        <>
        {/* Mobile view toggle */}
        <div className="flex justify-end mb-3 sm:hidden">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setMobileView("cards")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mobileView === "cards" ? "bg-green-700 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setMobileView("table")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mobileView === "table" ? "bg-green-700 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Table
            </button>
          </div>
        </div>

        {/* Mobile card layout */}
        <div className={`space-y-3 ${mobileView === "cards" ? "sm:hidden" : "hidden"}`}>
          <LeaderboardCards
            leaderboard={leaderboard}
            party={party}
            user={user}
            picksRevealed={picksRevealed}
            onSendUnlock={handleSendUnlock}
            unlockSending={unlockSending}
            unlockResult={unlockResult}
          />
        </div>

        {/* Desktop table (always on sm+, or on mobile when table view selected) */}
        <LeaderboardTable
          leaderboard={leaderboard}
          party={party}
          user={user}
          picksRevealed={picksRevealed}
          onSendUnlock={handleSendUnlock}
          unlockSending={unlockSending}
          unlockResult={unlockResult}
          mobileView={mobileView}
        />
        </>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 sm:gap-x-6">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-100 border border-red-400 rounded"></span>
          Missed Cut (+1 penalty)
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-50 border border-green-300 rounded"></span>
          Your row
        </div>
        <div>Lowest total score wins 🏆</div>
      </div>

      {/* Leave / Delete Party actions */}
      <div className="mt-12 border-t border-gray-200 pt-8 flex flex-col gap-4">
        {/* Leave Party — visible to non-creators, only during picking phase */}
        {user?.uid !== party.createdBy && party.status === "picking" && (
          <>
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="text-sm text-orange-400 hover:text-orange-600 transition-colors self-start"
              >
                🚪 Leave this party
              </button>
            ) : (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-medium text-orange-800 mb-3">
                  Are you sure you want to leave? Your picks will be deleted and you&apos;ll need the invite code to rejoin.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLeaveParty}
                    disabled={leaving}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {leaving ? "Leaving..." : "Yes, leave party"}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete Party — only visible to creator */}
        {user?.uid === party.createdBy && (
          <>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-400 hover:text-red-600 transition-colors self-start"
              >
                🗑️ Delete this party
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800 mb-3">
                  Are you sure? This will permanently delete the party, all picks, and all invites.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteParty}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Yes, delete permanently"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PartyPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div></div>}>
        <PartyContent />
      </Suspense>
    </ProtectedRoute>
  );
}
