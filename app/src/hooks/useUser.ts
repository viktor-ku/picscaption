import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAtom, useAtomValue } from "jotai";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { settingsAtom, userIdAtom } from "../lib/store";
import { useConvexAvailable } from "../components/ConvexClientProvider";

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

  // Use shared atom for userId - all useUser() instances see the same value
  const [storedUserId, setStoredUserId] = useAtom(userIdAtom);
  const userId = storedUserId as Id<"users"> | null;
  const settings = useAtomValue(settingsAtom);

  const createAnonymousUser = useMutation(api.users.createAnonymousUser);

  // Query user data if we have a userId and Convex is available
  const user = useQuery(
    api.users.getUser,
    isConvexAvailable && userId ? { userId } : "skip",
  );

  /**
   * Ensures a user exists. Creates one if needed.
   * Returns the user ID (existing or newly created).
   */
  const ensureUser = useCallback(async (): Promise<Id<"users"> | null> => {
    if (!isConvexAvailable) return null;

    // Check if we already have a user (from shared atom)
    if (storedUserId) {
      return storedUserId as Id<"users">;
    }

    // Create anonymous user
    try {
      const newUserId = await createAnonymousUser({
        name: settings.profileName || undefined,
        email: settings.profileEmail || undefined,
      });
      // Update shared atom - all useUser() instances will see this immediately
      setStoredUserId(newUserId);
      return newUserId;
    } catch (error) {
      console.error("Failed to create anonymous user:", error);
      return null;
    }
  }, [
    isConvexAvailable,
    storedUserId,
    setStoredUserId,
    createAnonymousUser,
    settings.profileName,
    settings.profileEmail,
  ]);

  // If Convex isn't available, return empty state
  if (!isConvexAvailable) {
    return {
      userId: null,
      user: null,
      isLoading: false,
      isAvailable: false,
      ensureUser,
    };
  }

  const isLoading = userId !== null && user === undefined;

  return {
    userId,
    user: user ?? null,
    isLoading,
    isAvailable: true,
    ensureUser,
  };
}
