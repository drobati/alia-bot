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
    coverageReporters: ["text", "lcov", "html"],
    coverageThreshold: {
        global: {
            statements: 75,
            branches: 60,
            functions: 75,
            lines: 75,
        },
    },
};