"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getParty, savePicks, getPicks } from "@/lib/firestore";
import { fetchDynamicGroups } from "@/lib/espn";
import { syncPartyStatus } from "@/lib/partySync";
import { GROUP_LABELS } from "@/lib/playerGroups";
import type { Party, Player, Picks, PlayerPick, PlayerGroup, GroupedPlayers } from "@/types";

function PicksContent() {
  const { partyId } = useParams<{ partyId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [party, setParty] = useState<Party | null>(null);
  const [picks, setPicks] = useState<Picks>({
    groupA: null,
    groupB: null,
    groupC: null,
    groupD: null,
    wildcard1: null,
    wildcard2: null,
  });
  const [playerGroups, setPlayerGroups] = useState<GroupedPlayers>({ A: [], B: [], C: [], D: [] });
  const [wildcardPlayers, setWildcardPlayers] = useState<Player[]>([]);
  const [wildcardSearch, setWildcardSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!partyId || !user) return;

    const load = async () => {
      try {
        const [partyData, existingPicks, dynamicData] = await Promise.all([
          getParty(partyId),
          getPicks(partyId, user.uid),
          fetchDynamicGroups(),
        ]);

        if (!partyData) {
          setError("Party not found");
          setLoading(false);
          return;
        }

        // Auto-sync party status with live ESPN tournament status
        const synced = await syncPartyStatus(partyData);
        setParty(synced);
        if (existingPicks) setPicks(existingPicks);
        setPlayerGroups(dynamicData.groups);
        setWildcardPlayers(dynamicData.wildcards);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
      setLoading(false);
    };

    load();
  }, [partyId, user]);

  const isLocked = party?.status !== "picking";

  const handleGroupPick = (group: PlayerGroup, player: Player) => {
    if (isLocked) return;
    const key = `group${group}` as keyof Picks;
    const current = picks[key] as PlayerPick | null;
    if (current?.playerId === player.id) {
      // Deselect
      setPicks({ ...picks, [key]: null });
    } else {
      setPicks({
        ...picks,
        [key]: { playerId: player.id, playerName: player.displayName },
      });
    }
  };

  const handleWildcardPick = (player: Player) => {
    if (isLocked) return;
    // Check if already picked as wildcard
    if (picks.wildcard1?.playerId === player.id) {
      setPicks({ ...picks, wildcard1: null });
      return;
    }
    if (picks.wildcard2?.playerId === player.id) {
      setPicks({ ...picks, wildcard2: null });
      return;
    }
    // Fill first empty wildcard slot
    if (!picks.wildcard1) {
      setPicks({
        ...picks,
        wildcard1: { playerId: player.id, playerName: player.displayName },
      });
    } else if (!picks.wildcard2) {
      setPicks({
        ...picks,
        wildcard2: { playerId: player.id, playerName: player.displayName },
      });
    }
  };

  const isWildcardSelected = (playerId: string) =>
    picks.wildcard1?.playerId === playerId || picks.wildcard2?.playerId === playerId;

  const allPicked =
    picks.groupA && picks.groupB && picks.groupC && picks.groupD && picks.wildcard1 && picks.wildcard2;

  const handleSave = async () => {
    if (!user || !partyId || !allPicked) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Re-check party status right before saving (prevents stale page saves)
      const freshParty = await getParty(partyId);
      if (freshParty) {
        const synced = await syncPartyStatus(freshParty);
        if (synced.status !== "picking") {
          setParty(synced);
          setError("🔒 Tournament has started — picks are locked. Your changes were not saved.");
          setSaving(false);
          return;
        }
      }
      await savePicks(partyId, user.uid, picks);
      setSuccess("Picks saved successfully!");
      setTimeout(() => router.push(`/party/${partyId}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save picks");
    }
    setSaving(false);
  };

  const filteredWildcards = wildcardPlayers.filter((p) =>
    p.displayName.toLowerCase().includes(wildcardSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error && !party) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">Pick Your Players</h1>
        <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
          {party?.tournamentName} — Select 1 player from each group + 2 wildcards
        </p>
        <p className="mt-1 text-xs text-gray-400 sm:text-sm">
          Groups based on live Official World Golf Ranking
        </p>
      </div>

      {isLocked && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
          🔒 Picks are locked — the tournament has started.
        </div>
      )}

      {/* Groups A-D */}
      {(["A", "B", "C", "D"] as PlayerGroup[]).map((group) => {
        const key = `group${group}` as keyof Picks;
        const selected = picks[key] as PlayerPick | null;
        return (
          <div key={group} className="mb-8">
            <h2 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-800">
              {GROUP_LABELS[group]}
              {selected && (
                <span className="text-sm text-green-600 break-words">✓ {selected.playerName}</span>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
              {playerGroups[group].map((player) => {
                const isSelected = selected?.playerId === player.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => handleGroupPick(group, player)}
                    disabled={isLocked}
                    className={`rounded-xl border-2 p-3 text-left transition-all sm:p-4 ${
                      isSelected
                        ? "border-green-600 bg-green-50 ring-2 ring-green-200"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    } ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="break-words text-sm font-medium leading-snug text-gray-900">
                      {player.displayName}
                    </div>
                    {isSelected && (
                      <div className="text-green-600 text-xs mt-1">✓ Selected</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Wildcards */}
      <div className="mb-8">
        <h2 className="mb-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-800">
          Wildcards — Pick 2 (Rank 25+)
        </h2>
        <p className="mb-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gray-500">
          Choose any 2 players not in Groups A–D.
          {picks.wildcard1 && (
            <span className="text-green-600 break-words">✓ {picks.wildcard1.playerName}</span>
          )}
          {picks.wildcard2 && (
            <span className="text-green-600 break-words">✓ {picks.wildcard2.playerName}</span>
          )}
        </p>

        <input
          type="text"
          placeholder="Search players..."
          value={wildcardSearch}
          onChange={(e) => setWildcardSearch(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
        />

        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3">
          {filteredWildcards.map((player) => {
            const isSelected = isWildcardSelected(player.id);
            const bothFilled = !!(picks.wildcard1 && picks.wildcard2) && !isSelected;
            return (
              <button
                key={player.id}
                onClick={() => handleWildcardPick(player)}
                disabled={isLocked || bothFilled}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  isSelected
                    ? "border-green-600 bg-green-50"
                    : bothFilled
                    ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {player.flagUrl && (
                    <img src={player.flagUrl} alt="" className="w-4 h-3" referrerPolicy="no-referrer" />
                  )}
                  <span className="truncate font-medium text-gray-900">{player.displayName}</span>
                </div>
                {isSelected && <div className="text-green-600 text-xs mt-0.5">✓ Selected</div>}
              </button>
            );
          })}
          {filteredWildcards.length === 0 && (
            <p className="col-span-2 py-4 text-center text-gray-400 sm:col-span-3">
              {wildcardSearch ? "No players match your search" : "Loading players..."}
            </p>
          )}
        </div>
      </div>

      {/* Summary & Save */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            {[picks.groupA, picks.groupB, picks.groupC, picks.groupD, picks.wildcard1, picks.wildcard2].filter(Boolean).length}
            /6 players selected
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            {error && <span className="text-red-600 text-sm">{error}</span>}
            {success && <span className="text-green-600 text-sm">{success}</span>}
            <button
              onClick={handleSave}
              disabled={!allPicked || saving || isLocked}
              className="w-full rounded-lg bg-green-700 px-6 py-2 font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Picks"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PicksPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <PicksContent />
    </ProtectedRoute>
  );
}
