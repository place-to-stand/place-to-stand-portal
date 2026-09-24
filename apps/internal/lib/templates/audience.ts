/**
 * Who reads a template's output. "team" covers anyone on our side — the shared
 * inbox and individual admins alike; the catalogs don't split them.
 */
export type TemplateAudience = 'team' | 'client' | 'visitor'
