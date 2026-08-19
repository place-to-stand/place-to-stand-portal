/**
 * Version of the CLI-facing contract, surfaced by `/api/cli/v1/meta` so the
 * client can warn when it is older or newer than the portal it is talking to.
 * Bump on a breaking change to a response shape, not on additive fields.
 */
export const CLI_API_VERSION = '1.0.0'
