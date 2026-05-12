"use client";

import { useState } from "react";
import type { Player, PlayerGroup } from "@/types";

interface GroupEditorProps {
  groups: Record<string, Player[]>;
  wildcards: Player[];
  fieldAvailable: boolean;
  onSave: (groups: Record<string, Player[]>) => void;
}

const GROUP_NAMES: PlayerGroup[] = ["A", "B", "C", "D"];
const GROUP_COLORS: Record<string, string> = {
  A: "border-red-300 bg-red-50",
  B: "border-blue-300 bg-blue-50",
  C: "border-yellow-300 bg-yellow-50",
  D: "border-purple-300 bg-purple-50",
};
const GROUP_LABELS: Record<string, string> = {
  A: "Group A — Elite",
  B: "Group B — Contenders",
  C: "Group C — Rising Stars",
  D: "Group D — Dark Horses",
};

export function GroupEditor({ groups, wildcards, fieldAvailable, onSave }: GroupEditorProps) {
  const [editGroups, setEditGroups] = useState<Record<string, Player[]>>({
    A: [...groups.A],
    B: [...groups.B],
    C: [...groups.C],
    D: [...groups.D],
  });
  const [pool, setPool] = useState<Player[]>([...wildcards]);
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: Player; from: string } | null>(null);
  const [poolSearch, setPoolSearch] = useState("");

  const moveToGroup = (player: Player, fromKey: string, toGroup: string) => {
    const updated = { ...editGroups };

    // Remove from current location
    if (fromKey === "pool") {
      setPool((prev) => prev.filter((p) => p.id !== player.id));
    } else {
      updated[fromKey] = updated[fromKey].filter((p) => p.id !== player.id);
    }

    // Add to target
    if (toGroup === "pool") {
      setPool((prev) => [...prev, player]);
    } else {
      updated[toGroup] = [...(updated[toGroup] || []), player];
    }

    setEditGroups(updated);
    setSelectedPlayer(null);
  };

  const handlePlayerClick = (player: Player, from: string) => {
    if (selectedPlayer?.player.id === player.id) {
      setSelectedPlayer(null);
    } else {
      setSelectedPlayer({ player, from });
    }
  };

  const totalGrouped = Object.values(editGroups).reduce((sum, g) => sum + g.length, 0);

  const filteredPool = pool.filter((p) =>
    p.displayName.toLowerCase().includes(poolSearch.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Customise Player Groups</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {fieldAvailable
              ? "Click a player, then click a group to move them."
              : "Field not announced yet — using OWGR rankings."}
          </p>
        </div>
        <span className="text-xs text-gray-500">{totalGrouped} players in groups</span>
      </div>

      {selectedPlayer && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm flex items-center justify-between">
          <span>
            Move <strong>{selectedPlayer.player.displayName}</strong> to:
          </span>
          <div className="flex gap-2">
            {GROUP_NAMES.filter((g) => g !== selectedPlayer.from).map((g) => (
              <button
                type="button" key={g}
                onClick={() => moveToGroup(selectedPlayer.player, selectedPlayer.from, g)}
                className="rounded bg-white border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
              >
                Group {g}
              </button>
            ))}
            {selectedPlayer.from !== "pool" && (
              <button
                type="button" onClick={() => moveToGroup(selectedPlayer.player, selectedPlayer.from, "pool")}
                className="rounded bg-gray-200 px-3 py-1 text-xs font-medium hover:bg-gray-300"
              >
                → Wildcard
              </button>
            )}
            <button
              type="button" onClick={() => setSelectedPlayer(null)}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Groups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {GROUP_NAMES.map((g) => (
          <div key={g} className={`rounded-lg border-2 p-3 ${GROUP_COLORS[g]}`}>
            <h4 className="text-xs font-bold text-gray-700 mb-2">
              {GROUP_LABELS[g]} ({editGroups[g].length})
            </h4>
            <div className="space-y-1.5">
              {editGroups[g].map((player) => (
                <button
                  type="button" key={player.id}
                  onClick={() => handlePlayerClick(player, g)}
                  className={`w-full text-left rounded-md border px-3 py-1.5 text-sm transition-all ${
                    selectedPlayer?.player.id === player.id
                      ? "border-green-500 bg-green-100 ring-2 ring-green-300"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                >
                  {player.displayName}
                  {player.country && (
                    <span className="ml-1 text-xs text-gray-400">({player.country})</span>
                  )}
                </button>
              ))}
              {editGroups[g].length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">Click a player below to add to this group</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Wildcard Pool */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-gray-700">Wildcard Pool ({pool.length})</h4>
        </div>
        <input
          type="text"
          placeholder="Search players..."
          value={poolSearch}
          onChange={(e) => setPoolSearch(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm mb-2 text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          {filteredPool.map((player) => (
            <button
              type="button" key={player.id}
              onClick={() => handlePlayerClick(player, "pool")}
              className={`text-left rounded-md border px-2 py-1.5 text-xs transition-all ${
                selectedPlayer?.player.id === player.id
                  ? "border-green-500 bg-green-100 ring-2 ring-green-300"
                  : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              {player.displayName}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button" onClick={() => onSave(editGroups)}
        className="mt-4 w-full rounded-lg bg-green-700 py-2.5 text-sm font-medium text-white hover:bg-green-600 transition-colors"
      >
        ✓ Confirm Groups
      </button>
    </div>
  );
}
