"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getParty, getAllPicksForParty, getUsersInfo, addInvites } from "@/lib/firestore";
import { fetchLeaderboard, calculateEffectiveScore, formatScoreToPar } from "@/lib/espn";
import { syncPartyStatus } from "@/lib/partySync";
import Link from "next/link";
import { Suspense } from "react";
import type { Party, Picks, PlayerScore, LeaderboardEntry } from "@/types";

function PartyContent() {
  const { partyId } = useParams<{ partyId: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [party, setParty] = useState<Party | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [emailBanner, setEmailBanner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const AUTO_REFRESH_SECONDS = 300; // 5 minutes

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
      // Clear after 8 seconds
      setTimeout(() => setEmailBanner(null), 8000);
    }
  }, [searchParams]);

  const buildLeaderboard = async (partyData: Party) => {
    const [allPicks, usersInfo, scores] = await Promise.all([
      getAllPicksForParty(partyData.id),
      getUsersInfo(partyData.memberUids),
      fetchLeaderboard(partyData.tournamentId).catch(() => [] as PlayerScore[]),
    ]);

    const scoreMap = new Map<string, PlayerScore>();
    scores.forEach((s) => scoreMap.set(s.playerId, s));

    const entries: LeaderboardEntry[] = partyData.memberUids.map((uid) => {
      const picks = allPicks[uid];
      const userInfo = usersInfo[uid] || { displayName: "Unknown" };

      const pickSlots = picks
        ? [
            { group: "A", ...picks.groupA },
            { group: "B", ...picks.groupB },
            { group: "C", ...picks.groupC },
            { group: "D", ...picks.groupD },
            { group: "W1", ...picks.wildcard1 },
            { group: "W2", ...picks.wildcard2 },
          ]
        : [];

      let totalScore = 0;
      const resolvedPicks = pickSlots.map((pick) => {
        if (!pick.playerId) {
          return {
            group: pick.group,
            playerId: "",
            playerName: "Not picked",
            scoreToPar: 0,
            displayScore: "-",
            status: "playing" as const,
          };
        }

        const score = scoreMap.get(pick.playerId);
        if (!score) {
          return {
            group: pick.group,
            playerId: pick.playerId,
            playerName: pick.playerName || "Unknown",
            scoreToPar: 0,
            displayScore: "-",
            status: "playing" as const,
          };
        }

        const { effectiveScore, penalty } = calculateEffectiveScore(score);
        totalScore += effectiveScore;

        const displayParts = [formatScoreToPar(score.scoreToPar)];
        if (penalty > 0) displayParts.push(`(+${penalty})`);

        return {
          group: pick.group,
          playerId: pick.playerId,
          playerName: score.playerName,
          scoreToPar: effectiveScore,
          displayScore: displayParts.join(" "),
          status: score.status,
          headshot: score.headshot,
        };
      });

      return {
        userName: userInfo.displayName,
        userPhotoURL: userInfo.photoURL,
        uid,
        picks: resolvedPicks,
        totalScore,
        displayTotal: formatScoreToPar(totalScore),
      };
    });

    // Sort by total score (lowest is best in golf)
    entries.sort((a, b) => a.totalScore - b.totalScore);
    return entries;
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

  const handleCopyInvite = () => {
    if (!party) return;
    const url = `${window.location.origin}/party/join?code=${party.inviteCode}`;
    navigator.clipboard.writeText(url);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
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
      }, 3000);
    } catch {
      setInviteResult("Failed to send invites — but invite code still works.");
    }
    setInviteSending(false);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">{party.name}</h1>
          <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
            {party.tournamentName} • {party.memberUids.length} member
            {party.memberUids.length !== 1 ? "s" : ""}
          </p>
          {party.buyIn > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                💰 €{party.buyIn} buy-in
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                🏆 1st: €{party.secondPlacePayout
                  ? (party.buyIn * party.memberUids.length) - (party.buyIn * 2)
                  : party.buyIn * party.memberUids.length}
              </span>
              {party.secondPlacePayout && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                  🥈 2nd: €{party.buyIn * 2}
                </span>
              )}
              <span className="text-xs text-gray-400">
                Pot: €{party.buyIn * party.memberUids.length}
              </span>
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            onClick={handleCopyInvite}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            {inviteCopied ? "✓ Copied!" : `📋 Invite Code: ${party.inviteCode}`}
          </button>
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

      {showInviteForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Invite more people</h3>
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

      {isLocked && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6 text-sm">
          🔒 Picks are locked — the tournament has started.
        </div>
      )}

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
        <div className="-mx-4 overflow-x-auto rounded-xl border border-gray-200 before:block before:px-3 before:py-2 before:text-center before:text-xs before:font-medium before:text-gray-500 before:content-['←_Scroll_→'] sm:mx-0 sm:before:hidden">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="bg-green-800 text-white">
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">#</th>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Player</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group A</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group B</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group C</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group D</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Wild 1</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Wild 2</th>
                <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Total</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => {
                const isOwnRow = entry.uid === user?.uid;
                const showPicks = picksRevealed || isOwnRow;
                const hasSubmitted = entry.picks.some((p) => p.playerId);
                return (
                <tr
                  key={entry.uid}
                  className={`border-b border-gray-100 ${
                    isOwnRow ? "bg-green-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-2 py-2 text-sm font-bold text-gray-500 sm:px-4 sm:py-3">
                    {idx === 0 ? "🏆" : idx === 1 && party.secondPlacePayout ? "🥈" : idx + 1}
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {entry.userPhotoURL && (
                        <img
                          src={entry.userPhotoURL}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="min-w-0 truncate font-medium text-gray-900">
                        {entry.userName}
                        {isOwnRow && (
                          <span className="text-green-600 text-xs ml-1">(you)</span>
                        )}
                      </span>
                      {picksRevealed && party.buyIn > 0 && idx === 0 && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          +€{party.secondPlacePayout
                            ? (party.buyIn * party.memberUids.length) - (party.buyIn * 2)
                            : party.buyIn * party.memberUids.length}
                        </span>
                      )}
                      {picksRevealed && party.buyIn > 0 && idx === 1 && party.secondPlacePayout && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          +€{party.buyIn * 2}
                        </span>
                      )}
                      {!showPicks && (
                        <span className={`ml-1 whitespace-nowrap text-xs ${hasSubmitted ? "text-green-600" : "text-gray-400"}`}>
                          {hasSubmitted ? "✓ Picks submitted" : "Waiting..."}
                        </span>
                      )}
                    </div>
                  </td>
                  {entry.picks.map((pick, pickIdx) => {
                    if (!showPicks) {
                      return (
                        <td key={pickIdx} className="px-2 py-2 text-center sm:px-4 sm:py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-base text-gray-300 sm:text-lg">🔒</span>
                            <span className="text-[10px] text-gray-400">Hidden</span>
                          </div>
                        </td>
                      );
                    }
                    const isCut = ["cut", "wd", "dq"].includes(pick.status);
                    return (
                      <td
                        key={pickIdx}
                        className={`px-2 py-2 text-center sm:px-4 sm:py-3 ${
                          isCut
                            ? "bg-red-100 border-l-2 border-red-400"
                            : ""
                        }`}
                        title={
                          isCut
                            ? `${pick.playerName} — Missed Cut (+1 penalty)`
                            : pick.playerName
                        }
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`max-w-[88px] truncate text-[11px] sm:max-w-[100px] sm:text-xs ${
                              isCut ? "text-red-700 line-through" : "text-gray-600"
                            }`}
                          >
                            {pick.playerName}
                          </span>
                          <span
                            className={`font-bold ${
                              isCut
                                ? "text-red-700"
                                : pick.scoreToPar < 0
                                ? "text-red-600"
                                : pick.scoreToPar > 0
                                ? "text-gray-700"
                                : "text-gray-500"
                            }`}
                          >
                            {pick.displayScore}
                          </span>
                          {isCut && (
                            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              🔒 CUT
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center sm:px-4 sm:py-3">
                    {showPicks ? (
                      <span
                        className={`text-base font-bold sm:text-lg ${
                          entry.totalScore < 0
                            ? "text-red-600"
                            : entry.totalScore > 0
                            ? "text-gray-800"
                            : "text-gray-500"
                        }`}
                      >
                        {entry.displayTotal}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-lg">🔒</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
