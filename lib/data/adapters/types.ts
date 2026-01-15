/**
 * Adapter Interface Types for Migration
 *
 * Defines interfaces for data adapters that can be implemented
 * by both Supabase and Convex. This enables feature-flag controlled
 * switching between databases during migration.
 *
 * Usage:
 *   1. Create adapter implementations for each domain
 *   2. Use feature flags to select the appropriate adapter
 *   3. All business logic calls the adapter interface
 */

// ============================================================
// COMMON TYPES
// ============================================================

/**
 * Standard result type for adapter operations
 */
export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================================
// USER TYPES
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "CLIENT";
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  role: "ADMIN" | "CLIENT";
}

export interface UpdateUserInput {
  name?: string;
  role?: "ADMIN" | "CLIENT";
}

// ============================================================
// CLIENT TYPES
// ============================================================

export interface Client {
  id: string;
  name: string;
  slug: string;
  billingType: "prepaid" | "net_30";
  website: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateClientInput {
  name: string;
  slug: string;
  billingType: "prepaid" | "net_30";
  website?: string;
  notes?: string;
}

export interface UpdateClientInput {
  name?: string;
  billingType?: "prepaid" | "net_30";
  website?: string;
  notes?: string;
}

// ============================================================
// PROJECT TYPES
// ============================================================

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "CLIENT" | "PERSONAL" | "INTERNAL";
  status: "ONBOARDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  clientId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string;
  type: "CLIENT" | "PERSONAL" | "INTERNAL";
  status?: "ONBOARDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  clientId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: "ONBOARDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
}

// ============================================================
// TASK TYPES
// ============================================================

export type TaskStatus =
  | "BACKLOG"
  | "ON_DECK"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "BLOCKED"
  | "DONE"
  | "ARCHIVED";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  rank: string;
  projectId: string;
  dueDate: Date | null;
  startDate: Date | null;
  priority: number | null;
  estimate: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  rank?: string;
  projectId: string;
  dueDate?: Date;
  startDate?: Date;
  priority?: number;
  estimate?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  rank?: string;
  dueDate?: Date | null;
  startDate?: Date | null;
  priority?: number | null;
  estimate?: number | null;
}

// ============================================================
// TIME LOG TYPES
// ============================================================

export interface TimeLog {
  id: string;
  projectId: string;
  userId: string;
  date: string; // ISO date YYYY-MM-DD
  hours: number;
  description: string | null;
  billable: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTimeLogInput {
  projectId: string;
  date: string;
  hours: number;
  description?: string;
  billable?: boolean;
  taskIds?: string[];
}

export interface UpdateTimeLogInput {
  date?: string;
  hours?: number;
  description?: string;
  billable?: boolean;
  taskIds?: string[];
}

// ============================================================
// ADAPTER INTERFACES
// ============================================================

/**
 * Users adapter interface
 */
export interface UsersAdapter {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  list(params?: PaginationParams): Promise<PaginatedResult<User>>;
  create(input: CreateUserInput, creatorId: string): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

/**
 * Clients adapter interface
 */
export interface ClientsAdapter {
  getById(id: string): Promise<Client | null>;
  getBySlug(slug: string): Promise<Client | null>;
  list(userId: string, params?: PaginationParams): Promise<PaginatedResult<Client>>;
  listAccessible(userId: string): Promise<Client[]>;
  create(input: CreateClientInput): Promise<Client>;
  update(id: string, input: UpdateClientInput): Promise<Client>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  addMember(clientId: string, userId: string): Promise<void>;
  removeMember(clientId: string, userId: string): Promise<void>;
  getMembers(clientId: string): Promise<User[]>;
}

/**
 * Projects adapter interface
 */
export interface ProjectsAdapter {
  getById(id: string): Promise<Project | null>;
  getBySlug(clientSlug: string, projectSlug: string): Promise<Project | null>;
  list(userId: string, params?: PaginationParams): Promise<PaginatedResult<Project>>;
  listByClient(clientId: string): Promise<Project[]>;
  listAccessible(userId: string): Promise<Project[]>;
  create(input: CreateProjectInput, creatorId: string): Promise<Project>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

/**
 * Tasks adapter interface
 */
export interface TasksAdapter {
  getById(id: string): Promise<Task | null>;
  listByProject(projectId: string, includeArchived?: boolean): Promise<Task[]>;
  listByStatus(projectId: string, status: TaskStatus): Promise<Task[]>;
  listAssignedTo(userId: string): Promise<Task[]>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
  updateStatus(id: string, status: TaskStatus): Promise<Task>;
  reorder(id: string, newRank: string): Promise<Task>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  assign(taskId: string, userId: string): Promise<void>;
  unassign(taskId: string, userId: string): Promise<void>;
  getAssignees(taskId: string): Promise<User[]>;
}

/**
 * Time logs adapter interface
 */
export interface TimeLogsAdapter {
  getById(id: string): Promise<TimeLog | null>;
  listByProject(
    projectId: string,
    dateRange?: { start: string; end: string }
  ): Promise<TimeLog[]>;
  listByUser(
    userId: string,
    dateRange?: { start: string; end: string }
  ): Promise<TimeLog[]>;
  create(input: CreateTimeLogInput, userId: string): Promise<TimeLog>;
  update(id: string, input: UpdateTimeLogInput): Promise<TimeLog>;
  delete(id: string): Promise<void>;
  getTotalHours(projectId: string, dateRange?: { start: string; end: string }): Promise<number>;
}

// ============================================================
// ADAPTER FACTORY
// ============================================================

/**
 * Adapter collection for all domains
 */
export interface DataAdapters {
  users: UsersAdapter;
  clients: ClientsAdapter;
  projects: ProjectsAdapter;
  tasks: TasksAdapter;
  timeLogs: TimeLogsAdapter;
}

/**
 * Get the appropriate adapter based on feature flags
 *
 * @example
 * ```typescript
 * const adapters = getAdapters();
 * const clients = await adapters.clients.listAccessible(userId);
 * ```
 */
export type GetAdapters = () => DataAdapters;
