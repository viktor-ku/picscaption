import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAtomValue } from "jotai";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { settingsAtom } from "../lib/store";
import { useConvexAvailable } from "../components/ConvexClientProvider";

const USER_ID_KEY = "picscaption-user-id";

export interface UseUserReturn {
  userId: Id<"users"> | null;
  user: {
    _id: Id<"users">;
    name?: string;
    email?: string;
    createdAt: number;
    googleId?: string;
    githubId?: string;
  } | null;
  isLoading: boolean;
  isAvailable: boolean;
  /** Creates an anonymous user if one doesn't exist. Call on first meaningful action. */
  ensureUser: () => Promise<Id<"users"> | null>;
}

/**
 * Hook for user management.
 * Does NOT auto-create users on mount.
 * Call `ensureUser()` when you want to create a user (e.g., on first image upload).
 *
 * Returns isAvailable: false if Convex is not configured.
 */
export function useUser(): UseUserReturn {
  const isConvexAvailable = useConvexAvailable();

  // If Convex isn't available, return early with empty state
  if (!isConvexAvailable) {
    return {
      userId: null,
      user: null,
      isLoading: false,
      isAvailable: false,
      ensureUser: async () => null,
    };
  }

  // Convex is available, use the full implementation
  return useUserInternal();
}

/**
 * Internal hook that actually uses Convex.
 * Only called when Convex is available.
 */
function useUserInternal(): UseUserReturn {
  const [userId, setUserId] = useState<Id<"users"> | null>(() => {
    // Initialize from localStorage synchronously
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(USER_ID_KEY);
    return stored ? (stored as Id<"users">) : null;
  });
  const settings = useAtomValue(settingsAtom);

  const createAnonymousUser = useMutation(api.users.createAnonymousUser);

  // Query user data if we have a userId
  const user = useQuery(api.users.getUser, userId ? { userId } : "skip");

  /**
   * Ensures a user exists. Creates one if needed.
   * Returns the user ID (existing or newly created).
   */
  const ensureUser = useCallback(async (): Promise<Id<"users"> | null> => {
    // Check if we already have a user
    const existingUserId = localStorage.getItem(USER_ID_KEY);
    if (existingUserId) {
      setUserId(existingUserId as Id<"users">);
      return existingUserId as Id<"users">;
    }

    // Create anonymous user
    try {
      const newUserId = await createAnonymousUser({
        name: settings.profileName || undefined,
        email: settings.profileEmail || undefined,
      });
      localStorage.setItem(USER_ID_KEY, newUserId);
      setUserId(newUserId);
      return newUserId;
    } catch (error) {
      console.error("Failed to create anonymous user:", error);
      return null;
    }
  }, [createAnonymousUser, settings.profileName, settings.profileEmail]);

  const isLoading = userId !== null && user === undefined;

  return {
    userId,
    user: user ?? null,
    isLoading,
    isAvailable: true,
    ensureUser,
  };
}
