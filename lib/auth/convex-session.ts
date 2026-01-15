import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Convex user type
 */
export type ConvexAppUser = Doc<"users">;

/**
 * User role type
 */
export type ConvexUserRole = "ADMIN" | "CLIENT";

/**
 * Get the current authenticated user from Convex
 *
 * This function is used in Server Components to get the current user.
 * It uses React's cache() for automatic deduplication within a request.
 *
 * @returns The current user or null if not authenticated
 */
export const getConvexCurrentUser = cache(
  async (): Promise<ConvexAppUser | null> => {
    try {
      const token = await convexAuthNextjsToken();

      if (!token) {
        return null;
      }

      const user = await fetchQuery(
        api.users.queries.me,
        {},
        { token }
      );

      return user;
    } catch (error) {
      // Auth errors are expected for unauthenticated users
      console.error("Failed to get Convex user:", error);
      return null;
    }
  }
);

/**
 * Require an authenticated user
 *
 * Redirects to sign-in page if not authenticated.
 * Use this in Server Components that require authentication.
 *
 * @returns The current authenticated user
 * @throws Redirects to /sign-in if not authenticated
 */
export const requireConvexUser = async (): Promise<ConvexAppUser> => {
  const user = await getConvexCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
};

/**
 * Require a user with a specific role
 *
 * Redirects to unauthorized page if user doesn't have required role.
 * Use this in Server Components that require specific roles.
 *
 * @param allowed - The role(s) that are allowed
 * @returns The current user with the required role
 * @throws Redirects to /sign-in if not authenticated
 * @throws Redirects to /unauthorized if user doesn't have required role
 */
export const requireConvexRole = async (
  allowed: ConvexUserRole | ConvexUserRole[]
): Promise<ConvexAppUser> => {
  const user = await requireConvexUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  if (!roles.includes(user.role as ConvexUserRole)) {
    redirect("/unauthorized");
  }

  return user;
};

/**
 * Check if the current user is an admin
 *
 * @returns True if the current user is an admin
 */
export const isConvexAdmin = async (): Promise<boolean> => {
  const user = await getConvexCurrentUser();
  return user?.role === "ADMIN";
};
