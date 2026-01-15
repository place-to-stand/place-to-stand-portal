/**
 * Convex HTTP routes
 *
 * Handles HTTP endpoints including OAuth callbacks for authentication.
 */

import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Mount auth routes for OAuth callbacks
auth.addHttpRoutes(http);

export default http;
