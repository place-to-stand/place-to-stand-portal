# @pts/server

Server helpers both portals share: the lazy database client (`db`, `DbTx`,
`uniqueViolation`), sign-in and checkout throttles, safe redirects, HTTP
error classes and the Supabase client factories. Each app keeps a thin file
at its old path (`lib/db`, `lib/auth/throttle`, …) that re-exports from here
or passes its own env, so imports in the apps did not change.
