// Tests for Issue #161 - Assistant missing some general knowledge questions
// These tests verify that the hybrid classifier correctly identifies the questions
// that were being missed after deployment

import { HybridClassifier } from './hybrid-classifier';

describe('HybridClassifier - Issue #161 General Knowledge Questions', () => {
    let classifier: HybridClassifier;

    beforeAll(() => {
        classifier = new HybridClassifier();
    });

    describe('Previously Missed General Knowledge Questions', () => {
        test('should correctly classify time/math questions', () => {
            const timeMathQuestions = [
                "How many seconds are in a minute?",
                "How many minutes are in an hour?",
                "How many hours are in a day?",
                "How many days are in a week?",
                "How many months are in a year?",
            ];

            timeMathQuestions.forEach(text => {
                const result = classifier.classify(text);
                const detailed = classifier.getDetailedClassification(text);

                // Log for debugging (disabled in CI)
                if (process.env.NODE_ENV !== 'test') {
                    // eslint-disable-next-line no-console
                    console.log(`Question: "${text}"`);
                    // eslint-disable-next-line no-console
                    console.log(`Result: ${result.intent} (${result.confidence} via ${result.method})`);
                    // eslint-disable-next-line no-console
                    console.log(`Keyword: ${detailed.keyword.intent} (${detailed.keyword.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log(`Bayesian: ${detailed.bayesian.intent} (${detailed.bayesian.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log('---');
                }

                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });

        test('should correctly classify economics questions', () => {
            const economicsQuestions = [
                "How do tariffs work?",
                "What are tariffs?",
                "How does the economy work?",
                "What is economics?",
                "How do taxes work?",
            ];

            economicsQuestions.forEach(text => {
                const result = classifier.classify(text);
                const detailed = classifier.getDetailedClassification(text);

                // Log for debugging (disabled in CI)
                if (process.env.NODE_ENV !== 'test') {
                    // eslint-disable-next-line no-console
                    console.log(`Question: "${text}"`);
                    // eslint-disable-next-line no-console
                    console.log(`Result: ${result.intent} (${result.confidence} via ${result.method})`);
                    // eslint-disable-next-line no-console
                    console.log(`Keyword: ${detailed.keyword.intent} (${detailed.keyword.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log(`Bayesian: ${detailed.bayesian.intent} (${detailed.bayesian.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log('---');
                }

                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });

        test('should correctly classify time concept questions', () => {
            const timeConceptQuestions = [
                "When is noon?",
                "When is midnight?",
                "What time is noon?",
                "What is noon?",
            ];

            timeConceptQuestions.forEach(text => {
                const result = classifier.classify(text);
                const detailed = classifier.getDetailedClassification(text);

                // Log for debugging (disabled in CI)
                if (process.env.NODE_ENV !== 'test') {
                    // eslint-disable-next-line no-console
                    console.log(`Question: "${text}"`);
                    // eslint-disable-next-line no-console
                    console.log(`Result: ${result.intent} (${result.confidence} via ${result.method})`);
                    // eslint-disable-next-line no-console
                    console.log(`Keyword: ${detailed.keyword.intent} (${detailed.keyword.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log(`Bayesian: ${detailed.bayesian.intent} (${detailed.bayesian.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log('---');
                }

                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });
    });

    describe('Questions That Should Be Filtered (Real-Time Knowledge)', () => {
        test('should correctly filter real-time and personal questions', () => {
            const realTimeQuestions = [
                "Where am I right now?",
                "What time is it?",
                "What's the weather today?",
                "What's happening now?",
                "Who is online?",
            ];

            realTimeQuestions.forEach(text => {
                const result = classifier.classify(text);

                // Test should pass - no debugging needed

                // Log for debugging (disabled in CI)
                if (process.env.NODE_ENV !== 'test') {
                    // eslint-disable-next-line no-console
                    console.log(`Question: "${text}"`);
                    // eslint-disable-next-line no-console
                    console.log(`Result: ${result.intent} (${result.confidence} via ${result.method})`);
                    // eslint-disable-next-line no-console
                    console.log('---');
                }

                // These should NOT be classified as general-knowledge
                expect(result.intent).not.toBe('general-knowledge');
            });
        });
    });

    describe('Previously Working Questions Should Still Work', () => {
        test('should maintain high confidence for building/structure questions', () => {
            const workingQuestions = [
                "How tall is the tallest building in the world?",
                "What's the biggest bone in the body?",
                "What is the largest planet?",
                "Who wrote Romeo and Juliet?",
            ];

            workingQuestions.forEach(text => {
                const result = classifier.classify(text);

                // Log for debugging (disabled in CI)
                if (process.env.NODE_ENV !== 'test') {
                    // eslint-disable-next-line no-console
                    console.log(`Question: "${text}"`);
                    // eslint-disable-next-line no-console
                    console.log(`Result: ${result.intent} (${result.confidence} via ${result.method})`);
                    // eslint-disable-next-line no-console
                    console.log('---');
                }

                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.7);
            });
        });
    });

    describe('Confidence Threshold Validation', () => {
        test('all target questions should exceed 0.5 confidence threshold', () => {
            const allTargetQuestions = [
                "How many seconds are in a minute?",
                "How do tariffs work?",
                "When is noon?",
            ];

            allTargetQuestions.forEach(text => {
                const result = classifier.classify(text);
                const detailed = classifier.getDetailedClassification(text);

                // Log for debugging (disabled in CI)
                if (process.env.NODE_ENV !== 'test') {
                    // eslint-disable-next-line no-console
                    console.log(`\n=== ISSUE #161 TARGET: "${text}" ===`);
                    // eslint-disable-next-line no-console
                    console.log(`Final Result: ${result.intent} (${result.confidence} via ${result.method})`);
                    // eslint-disable-next-line no-console
                    console.log(`Keyword Method: ${detailed.keyword.intent} (${detailed.keyword.confidence})`);
                    // eslint-disable-next-line no-console
                    console.log(`Bayesian Method: ${detailed.bayesian.intent} (${detailed.bayesian.confidence})`);
                    const passSymbol = result.confidence > 0.5 && result.intent === 'general-knowledge' ? '✅' : '❌';
                    // eslint-disable-next-line no-console
                    console.log(`PASSES THRESHOLD (>0.5): ${passSymbol}`);
                    // eslint-disable-next-line no-console
                    console.log('================================\n');
                }

                // Critical assertion - these must pass for issue to be resolved
                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });
    });
});