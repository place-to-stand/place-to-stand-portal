/**
 * Convex Auth setup
 *
 * Configures Google OAuth authentication with email-based account matching.
 * When a user signs in with Google, we:
 * 1. Match them to an existing user by email (for migrated users)
 * 2. Create a new user if no match found
 * 3. Link the Convex auth identity to the user record
 */

import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";

/**
 * Default role for new users created via Google OAuth.
 * Existing migrated users will retain their original roles.
 */
const DEFAULT_USER_ROLE = "CLIENT" as const;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],

  callbacks: {
    /**
     * Called after successful OAuth authentication.
     *
     * This callback handles email-based account matching:
     * - For migrated users: Links the Convex auth identity to existing user
     * - For new users: Creates a new user record with CLIENT role
     */
    async createOrUpdateUser(ctx, args) {
      // Get user info from OAuth profile
      const email = args.profile?.email as string | undefined;
      const name = args.profile?.name as string | undefined;

      if (!email) {
        throw new Error("Email is required for authentication");
      }

      // Check if we're updating an existing auth user
      if (args.existingUserId) {
        // User already has a linked account, just update profile if needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingUser = await (ctx.db as any).get(args.existingUserId);
        if (existingUser) {
          // Update fullName if it changed
          if (name && name !== existingUser.fullName) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (ctx.db as any).patch(args.existingUserId, {
              fullName: name,
              updatedAt: Date.now(),
            });
          }
          return args.existingUserId;
        }
      }

      // Look for existing user by email (migrated from Supabase)
      // Note: Using raw query since ctx.db doesn't have our schema types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingUserByEmail = await (ctx.db as any)
        .query("users")
        .withIndex("by_email", (q: { eq: (field: string, value: string) => unknown }) =>
          q.eq("email", email.toLowerCase())
        )
        .first();

      if (existingUserByEmail) {
        // Found migrated user - link auth identity to them
        // Only update if they don't already have an authId
        if (!existingUserByEmail.authId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (ctx.db as any).patch(existingUserByEmail._id, {
            authId: args.profile?.subject,
            // Update fullName if not set or if Google provides a better one
            ...(name && !existingUserByEmail.fullName ? { fullName: name } : {}),
            updatedAt: Date.now(),
          });
        }
        return existingUserByEmail._id;
      }

      // New user - create account with default role
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newUserId = await (ctx.db as any).insert("users", {
        authId: args.profile?.subject,
        email: email.toLowerCase(),
        fullName: name || undefined,
        role: DEFAULT_USER_ROLE,
        createdAt: now,
        updatedAt: now,
      });

      return newUserId;
    },
  },
});
