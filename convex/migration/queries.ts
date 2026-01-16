/**
 * Migration queries for validation
 *
 * These queries are used to validate dual-write consistency between
 * Supabase and Convex. They don't require authentication since they're
 * only used by internal validation scripts.
 */

import { query } from "../_generated/server";

/**
 * List all clients for validation
 * Returns all clients including deleted ones
 */
export const listAllClients = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();

    return clients.map((c) => ({
      _id: c._id,
      supabaseId: c.supabaseId,
      name: c.name,
      slug: c.slug,
      billingType: c.billingType,
      notes: c.notes,
      deletedAt: c.deletedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

/**
 * List all projects for validation
 */
export const listAllProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();

    return projects.map((p) => ({
      _id: p._id,
      supabaseId: p.supabaseId,
      clientId: p.clientId,
      name: p.name,
      slug: p.slug,
      type: p.type,
      status: p.status,
      startsOn: p.startsOn,
      endsOn: p.endsOn,
      deletedAt: p.deletedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

/**
 * List all users for validation
 */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    return users.map((u) => ({
      _id: u._id,
      supabaseId: u.supabaseId,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      avatarUrl: u.avatarUrl,
      deletedAt: u.deletedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  },
});

/**
 * List all client members for validation
 */
export const listAllClientMembers = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("clientMembers").collect();

    return members.map((m) => ({
      _id: m._id,
      supabaseId: m.supabaseId,
      clientId: m.clientId,
      userId: m.userId,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  },
});
