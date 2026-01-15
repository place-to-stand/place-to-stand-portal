/**
 * Next.js Middleware Entry Point
 *
 * This file must be named middleware.ts and placed at the project root.
 * It delegates to proxy.ts which handles both Supabase and Convex Auth flows.
 */

import { proxy, config as proxyConfig } from './proxy'

export const middleware = proxy
export const config = proxyConfig
