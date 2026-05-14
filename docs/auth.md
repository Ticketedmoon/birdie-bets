# Authentication Architecture — BirdieBets

## Overview

BirdieBets uses **Firebase Authentication** with **Google Sign-In** as the sole auth provider. Authentication is handled entirely on the client side using the Firebase JS SDK. There is no server-side session management — the Firebase SDK manages tokens and persistence automatically via browser storage.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Auth Provider | Firebase Authentication |
| Sign-in Method | Google OAuth 2.0 (popup flow) |
| State Management | React Context (`AuthContext`) |
| Database | Cloud Firestore (user profiles) |
| Route Protection | Client-side redirect (`ProtectedRoute` component) |

---

## Architecture Diagram

```
┌─────────────┐     Google OAuth      ┌──────────────────┐
│   Browser    │ ◄──────────────────► │  Google Identity  │
│  (Firebase   │     popup flow        │    Platform       │
│   JS SDK)    │                       └──────────────────┘
└──────┬───────┘
       │
       │ onAuthStateChanged()
       ▼
┌──────────────┐                      ┌──────────────────┐
│ AuthContext   │ ────── reads ──────► │ Cloud Firestore   │
│ (React)      │    user profile       │ /users/{uid}     │
└──────┬───────┘                      └──────────────────┘
       │
       │ provides { user, loading, signIn, signOut }
       ▼
┌──────────────┐
│ App Pages    │
│ (wrapped in  │
│ ProtectedRoute)
└──────────────┘
```

---

## Key Files

| File | Role |
|------|------|
| `src/lib/firebase.ts` | Firebase app initialization + lazy Auth/Firestore getters |
| `src/contexts/AuthContext.tsx` | Auth state provider (React Context) |
| `src/components/ProtectedRoute.tsx` | Route guard — redirects unauthenticated users |
| `src/components/Providers.tsx` | Client-side mounting wrapper to avoid SSR hydration issues |
| `src/app/login/page.tsx` | Login page with Google Sign-In button |
| `src/app/page.tsx` | Root redirect — sends users to `/dashboard` or `/login` |
| `src/app/layout.tsx` | Wraps entire app in `<Providers>` |

---

## Detailed Flow

### 1. Firebase Initialization (`src/lib/firebase.ts`)

Firebase is configured via `NEXT_PUBLIC_FIREBASE_*` environment variables. The app, auth, and Firestore instances are **lazily initialized** — only created when first accessed:

```ts
function getApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}
```

This prevents initialization during server-side rendering where `window` is not available.

### 2. Auth Context (`src/contexts/AuthContext.tsx`)

The `AuthProvider` wraps the entire application and provides:

- `user: User | null` — the current Firebase user object (or null if signed out)
- `loading: boolean` — true while Firebase is determining auth state
- `signInWithGoogle()` — triggers Google popup sign-in
- `signOut()` — signs the user out

**On mount**, it subscribes to Firebase's `onAuthStateChanged` listener:

```ts
useEffect(() => {
  const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
    setUser(firebaseUser);
    if (firebaseUser) {
      // Upsert user profile in Firestore on first sign-in
      const userRef = doc(getFirebaseDb(), "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          createdAt: new Date().toISOString(),
        });
      }
    }
    setLoading(false);
  });
  return () => unsubscribe();
}, []);
```

**Key behaviors:**
- When a user signs in for the first time, a Firestore document is created at `/users/{uid}` with their Google profile data
- If the user already exists, the profile is **not** updated (so renames in Google won't overwrite)
- `loading` stays `true` until Firebase resolves the auth state — this prevents flash-of-unauthenticated-content

### 3. Sign-In Flow (`src/app/login/page.tsx`)

The login page shows a single "Sign in with Google" button:

```
User clicks button
  → signInWithGoogle()
    → GoogleAuthProvider + signInWithPopup()
      → Google OAuth consent screen (popup)
        → User grants access
          → Firebase issues auth token
            → onAuthStateChanged fires
              → AuthContext updates user state
                → Login page detects user, redirects to /dashboard
```

If the user is already signed in when they visit `/login`, they are immediately redirected to `/dashboard`.

### 4. Route Protection (`src/components/ProtectedRoute.tsx`)

Protected pages wrap their content in `<ProtectedRoute>`:

```tsx
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <DashboardContent />
    </ProtectedRoute>
  );
}
```

The component:
1. While `loading` is true → shows a spinner
2. If `loading` is false and `user` is null → redirects to `/login`
3. If `user` exists → renders children

**Protected pages:** `/dashboard`, `/party/[partyId]`, `/party/[partyId]/picks`, `/party/create`  
**Public pages:** `/login`, `/` (root, which auto-redirects)

### 5. SSR Hydration Safety (`src/components/Providers.tsx`)

Since Firebase Auth only works in the browser, the `Providers` component delays rendering the `AuthProvider` until after client-side mount:

```ts
export function Providers({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Spinner />;
  return <AuthProvider>{children}</AuthProvider>;
}
```

This prevents SSR/hydration mismatches where the server would render unauthenticated content but the client would have a valid Firebase session.

### 6. Root Page (`src/app/page.tsx`)

The root `/` page is a simple redirector — it checks auth state and sends the user to either `/dashboard` (authenticated) or `/login` (unauthenticated).

---

## User Data in Firestore

### `/users/{uid}` document

Created on first sign-in, stores:

```ts
{
  displayName: string;  // from Google profile
  email: string;        // from Google profile
  photoURL: string;     // Google avatar URL
  createdAt: string;    // ISO timestamp
}
```

This document is used throughout the app:
- `getUserEmail(uid)` — retrieves email for sending notifications
- `getUserDisplayName(uid)` — shown in leaderboard/UI
- `getUsersInfo(uids)` — batch lookup for party member display names and photos

### How `user.uid` is used

The Firebase `uid` is the primary identifier throughout the app:
- Party membership: `party.memberUids[]` stores Firebase UIDs
- Party ownership: `party.createdBy` is a Firebase UID
- Picks storage: Firestore path `/parties/{partyId}/picks/{uid}`
- Pick unlocks: `pickUnlock.uid` and `pickUnlock.createdBy` are Firebase UIDs

---

## Security Model

### What's protected

| Action | Authorization |
|--------|--------------|
| View party | Must be authenticated (ProtectedRoute) |
| Create party | Must be authenticated |
| Join party | Must be authenticated + valid invite code |
| Submit picks | Must be party member + party in "picking" status |
| Submit unlocked picks | Must have valid, unexpired unlock token |
| Send unlock email | Must be party creator + party is "locked" |
| Delete party | Must be party creator |
| Leave party | Must be party member + party in "picking" status |

### What's NOT protected (current limitations)

- **No server-side auth verification on API routes** — the API routes (`/api/send-pick-unlock`, `/api/submit-unlocked-picks`, etc.) trust the `callerUid` sent in the request body. They validate business rules (is this user the creator? is this user a member?) but don't verify the caller's Firebase token server-side.
- **No Firestore Security Rules mentioned in code** — authorization relies on client-side checks and API route validation. Firestore Security Rules should be configured in the Firebase console to enforce access at the database level.
- **User profile is not updated after initial creation** — if a user changes their Google display name or photo, the Firestore `/users/{uid}` document retains the original values.

---

## Environment Variables Required

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

All prefixed with `NEXT_PUBLIC_` so they're available in client-side code (required by Firebase JS SDK).

---

## Session Persistence

Firebase Auth automatically persists the user session in browser storage (IndexedDB by default). This means:
- Users remain signed in across page refreshes and browser restarts
- No explicit session token management is needed
- Sign-out explicitly clears the persisted session via `firebaseSignOut()`
- Token refresh is handled automatically by the Firebase SDK
