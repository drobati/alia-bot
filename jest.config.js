module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testPathIgnorePatterns: ["<rootDir>/dist/"],
    collectCoverageFrom: [
        "src/**/*.{ts,js}",
        "!src/**/*.test.{ts,js}",
        "!src/**/*.d.ts",
        "!src/types/**",
    ],
    coverageReporters: ["text", "lcov", "html", "json"],
    coverageThreshold: {
        global: {
            statements: 40,
            branches: 30,
            functions: 50,
            lines: 40,
        },
    },
};