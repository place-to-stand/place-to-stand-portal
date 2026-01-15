"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Convex user type from database
 */
export type ConvexUser = Doc<"users">;

/**
 * Return type for useConvexUser hook
 */
type UseConvexUserReturn = {
  /** Whether authentication is being checked */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** The current user, or null if not authenticated */
  user: ConvexUser | null | undefined;
};

/**
 * Hook to get the current authenticated user from Convex
 *
 * This hook:
 * 1. Checks if the user is authenticated via Convex Auth
 * 2. Fetches the user document from the database
 * 3. Returns loading state, auth state, and user data
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { isLoading, isAuthenticated, user } = useConvexUser();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isAuthenticated) return <SignInButton />;
 *
 *   return <div>Hello, {user?.name}</div>;
 * }
 * ```
 */
export function useConvexUser(): UseConvexUserReturn {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();

  // Fetch user from database (only if authenticated)
  // The query will return undefined while loading, null if not found
  const user = useQuery(
    api.users.queries.me,
    isAuthenticated ? {} : "skip"
  );

  // Loading if auth is loading OR if authenticated but user query is loading
  const isLoading = isAuthLoading || (isAuthenticated && user === undefined);

  return {
    isLoading,
    isAuthenticated,
    user: isAuthenticated ? user : null,
  };
}
