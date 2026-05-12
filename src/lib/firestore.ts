import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

// Helper to get db instance
const db = () => getFirebaseDb();
import type { Party, Picks, PartyInvite } from "@/types";

// Generate a 6-character invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- Party CRUD ---

export async function createParty(
  name: string,
  createdBy: string,
  tournamentId: string,
  tournamentName: string,
  tournamentStartDate: string,
  buyIn: number = 10,
  currency: string = "EUR",
  secondPlacePayout: boolean = false,
  thirdPlacePayout: boolean = false
): Promise<Party> {
  const partyRef = doc(collection(db(), "parties"));
  const party: Omit<Party, "id"> = {
    name,
    createdBy,
    inviteCode: generateInviteCode(),
    tournamentId,
    tournamentName,
    tournamentStartDate,
    createdAt: new Date().toISOString(),
    status: "picking",
    memberUids: [createdBy],
    buyIn,
    currency,
    secondPlacePayout,
    thirdPlacePayout,
  };
  await setDoc(partyRef, party);
  return { id: partyRef.id, ...party };
}

export async function getParty(partyId: string): Promise<Party | null> {
  const snap = await getDoc(doc(db(), "parties", partyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Party;
}

export async function getPartiesForUser(uid: string): Promise<Party[]> {
  const q = query(collection(db(), "parties"), where("memberUids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Party);
}

export async function joinPartyByCode(code: string, uid: string): Promise<Party | null> {
  const q = query(collection(db(), "parties"), where("inviteCode", "==", code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const partyDoc = snap.docs[0];
  const party = { id: partyDoc.id, ...partyDoc.data() } as Party;

  if (party.memberUids.includes(uid)) return party; // already a member

  await updateDoc(doc(db(), "parties", partyDoc.id), {
    memberUids: arrayUnion(uid),
  });

  return { ...party, memberUids: [...party.memberUids, uid] };
}

export async function updatePartyStatus(
  partyId: string,
  status: Party["status"]
): Promise<void> {
  await updateDoc(doc(db(), "parties", partyId), { status });
}

export async function deleteParty(partyId: string): Promise<void> {
  // Delete subcollections (picks, invites) first
  const picksSnap = await getDocs(collection(db(), "parties", partyId, "picks"));
  for (const d of picksSnap.docs) {
    await deleteDoc(d.ref);
  }
  const invitesSnap = await getDocs(collection(db(), "parties", partyId, "invites"));
  for (const d of invitesSnap.docs) {
    await deleteDoc(d.ref);
  }
  // Delete the party document
  await deleteDoc(doc(db(), "parties", partyId));
}

// --- Picks ---

export async function savePicks(partyId: string, uid: string, picks: Picks): Promise<void> {
  await setDoc(doc(db(), "parties", partyId, "picks", uid), {
    ...picks,
    lockedAt: picks.lockedAt || new Date().toISOString(),
  });
}

export async function getPicks(partyId: string, uid: string): Promise<Picks | null> {
  const snap = await getDoc(doc(db(), "parties", partyId, "picks", uid));
  if (!snap.exists()) return null;
  return snap.data() as Picks;
}

export async function getAllPicksForParty(
  partyId: string
): Promise<Record<string, Picks>> {
  const snap = await getDocs(collection(db(), "parties", partyId, "picks"));
  const result: Record<string, Picks> = {};
  snap.docs.forEach((d) => {
    result[d.id] = d.data() as Picks;
  });
  return result;
}

// --- Invites ---

export async function addInvites(partyId: string, emails: string[], invitedBy: string): Promise<void> {
  for (const email of emails) {
    const normalised = email.toLowerCase().trim();
    if (!normalised) continue;
    await setDoc(doc(db(), "parties", partyId, "invites", normalised), {
      email: normalised,
      status: "pending",
      invitedBy,
    } satisfies PartyInvite);
  }
}

export async function getPendingInvitesForEmail(email: string): Promise<{ partyId: string; partyName: string }[]> {
  // Query all parties for pending invites matching this email
  // Note: This requires checking each party's invites subcollection.
  // For MVP, we use collectionGroup queries.
  const q = query(
    collection(db(), "parties"),
    where("memberUids", "not-in", [[]])  // get all parties
  );
  // TODO: For scale, use collectionGroup query on "invites" collection
  // For now, this is handled at the component level by checking invites on known parties
  return [];
}

// --- User Info ---

export async function getUserDisplayName(uid: string): Promise<string> {
  const snap = await getDoc(doc(db(), "users", uid));
  if (!snap.exists()) return "Unknown";
  return snap.data().displayName || "Unknown";
}

export async function getUsersInfo(
  uids: string[]
): Promise<Record<string, { displayName: string; photoURL?: string }>> {
  const result: Record<string, { displayName: string; photoURL?: string }> = {};
  // Firestore doesn't support "in" queries > 30 items, batch if needed
  for (const uid of uids) {
    const snap = await getDoc(doc(db(), "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      result[uid] = {
        displayName: data.displayName || "Unknown",
        photoURL: data.photoURL,
      };
    }
  }
  return result;
}
