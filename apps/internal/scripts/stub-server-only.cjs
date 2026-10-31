/* eslint-disable @typescript-eslint/no-require-imports */
/** Lets server modules run under tsx: `server-only` is a bundler marker. */
const Module = require('module')
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request === 'server-only') return require.resolve('./stub-styles.cjs')
  return resolve.call(this, request, ...rest)
}
