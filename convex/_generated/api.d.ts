/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as clients_mutations from "../clients/mutations.js";
import type * as clients_queries from "../clients/queries.js";
import type * as http from "../http.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_softDelete from "../lib/softDelete.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_validators_activityMetadata from "../lib/validators/activityMetadata.js";
import type * as lib_validators_date from "../lib/validators/date.js";
import type * as migration_mutations from "../migration/mutations.js";
import type * as migration_queries from "../migration/queries.js";
import type * as projects_mutations from "../projects/mutations.js";
import type * as projects_queries from "../projects/queries.js";
import type * as storage_attachments from "../storage/attachments.js";
import type * as storage_avatars from "../storage/avatars.js";
import type * as tasks_mutations from "../tasks/mutations.js";
import type * as tasks_queries from "../tasks/queries.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "clients/mutations": typeof clients_mutations;
  "clients/queries": typeof clients_queries;
  http: typeof http;
  "lib/encryption": typeof lib_encryption;
  "lib/permissions": typeof lib_permissions;
  "lib/softDelete": typeof lib_softDelete;
  "lib/time": typeof lib_time;
  "lib/validators": typeof lib_validators;
  "lib/validators/activityMetadata": typeof lib_validators_activityMetadata;
  "lib/validators/date": typeof lib_validators_date;
  "migration/mutations": typeof migration_mutations;
  "migration/queries": typeof migration_queries;
  "projects/mutations": typeof projects_mutations;
  "projects/queries": typeof projects_queries;
  "storage/attachments": typeof storage_attachments;
  "storage/avatars": typeof storage_avatars;
  "tasks/mutations": typeof tasks_mutations;
  "tasks/queries": typeof tasks_queries;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
