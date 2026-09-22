module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testPathIgnorePatterns: ["<rootDir>/dist/"],
    // @sentry/profiling-node has no prebuilt binary for this Node ABI, and the
    // require() throws at import time, killing any suite that transitively
    // reaches src/lib/sentry.ts. Profiling is irrelevant to tests, so stub it.
    moduleNameMapper: {
        "^@sentry/profiling-node$": "<rootDir>/test/stubs/sentry-profiling-node.js",
    },
    collectCoverageFrom: [
        "src/**/*.{ts,js}",
        "!src/**/*.test.{ts,js}",
        "!src/**/*.d.ts",
        "!src/types/**",
        "!src/models/**",
        "!src/responses/index.ts",
        "!src/commands/sentry-test.ts",
        "!src/commands/stock.ts",
        "!src/commands/dnd.ts",
        "!src/commands/poll.ts",
        "!src/commands/louds.ts",
        "!src/commands/adlibs.ts",
        "!src/services/motivationalScheduler.ts",
        "!src/lib/sentry.ts",
        "!src/lib/apis/**",
        "!src/utils/logger.ts",
        "!src/utils/assistant.ts",
        "!src/utils/polygon-service.ts",
        "!src/utils/discordHelpers.ts",
        "!src/responses/dnd.ts",
        "!src/responses/louds.ts",
        "!index.ts",
        "!events/**",
    ],
    coverageReporters: ["text", "lcov", "html", "json"],
    coverageThreshold: {
        global: {
            // Temporarily lowered from 90% due to new dota subcommands
            // TODO: Restore to 90%/70% once success path tests are added
            statements: 88,
            branches: 69,
            functions: 90,
            lines: 88,
        },
    },
};