"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
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

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getFirebaseAuth(), provider);
  };

  const signOut = async () => {
    await firebaseSignOut(getFirebaseAuth());
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
