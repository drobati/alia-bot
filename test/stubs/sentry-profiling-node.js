/**
 * Jest stub for @sentry/profiling-node.
 *
 * The package ships prebuilt native binaries for Node ABI 108 and 115. Under
 * Node 26 (ABI 147) there is no matching binary, so requiring it throws and any
 * suite whose import graph reaches src/lib/sentry.ts fails to LOAD — reporting
 * "Tests: 0 total" rather than a test failure, which reads like a broken suite.
 *
 * Profiling has no bearing on any test, so jest.config.js maps the package here.
 * Remove this once the dependency ships a binary for the Node version in use.
 */
module.exports = {
    nodeProfilingIntegration: () => ({ name: 'NodeProfiling', setupOnce() {} }),
};
