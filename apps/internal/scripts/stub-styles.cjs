/**
 * Stubs style imports for the SSR smoke harness.
 *
 * The tiptap primitives `import "...scss"` for their side effect, which the
 * Next bundler handles but a bare node/tsx run does not. The harness only
 * cares whether the components render, so resolving these to nothing is
 * exactly right.
 */
require.extensions['.scss'] = () => {}
require.extensions['.css'] = () => {}
