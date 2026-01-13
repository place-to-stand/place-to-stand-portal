/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_softDelete from "../lib/softDelete.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_validators_activityMetadata from "../lib/validators/activityMetadata.js";
import type * as lib_validators_date from "../lib/validators/date.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "lib/encryption": typeof lib_encryption;
  "lib/permissions": typeof lib_permissions;
  "lib/softDelete": typeof lib_softDelete;
  "lib/time": typeof lib_time;
  "lib/validators": typeof lib_validators;
  "lib/validators/activityMetadata": typeof lib_validators_activityMetadata;
  "lib/validators/date": typeof lib_validators_date;
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
