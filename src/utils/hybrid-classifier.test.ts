// Unit tests for business discussion filtering in hybrid classifier

import { HybridClassifier } from './hybrid-classifier';

describe('HybridClassifier - Business Discussion Filtering', () => {
    let classifier: HybridClassifier;

    beforeAll(() => {
        classifier = new HybridClassifier();
    });

    describe('Business Discussion Detection', () => {
        test('should filter out personal business discussions', () => {
            const businessDiscussions = [
                "Here's what I want to build. A trading card platform using AI.",
                "I'm building a platform for trading cards with AI integration.",
                "What I want to create is a trading card marketplace.",
                "How I plan to build this is with modern web technology.",
                "This is my business idea: an AI-powered trading card platform.",
            ];

            businessDiscussions.forEach(text => {
                const result = classifier.classify(text);
                expect(result.intent).toBe('business-discussion');
                expect(result.confidence).toBeGreaterThan(0.9);
                expect(result.method).toBe('keyword');
            });
        });

        test('should filter out project-related questions', () => {
            const projectQuestions = [
                "What this platform does is trade items",
                "What the government should do for my business",
                "What tariffs mean for my trading platform",
                "What economics principles I'm using",
                "When will I launch? Hopefully next year",
            ];

            projectQuestions.forEach(text => {
                const result = classifier.classify(text);
                expect(result.intent).toBe('business-discussion');
                expect(result.confidence).toBeGreaterThan(0.9);
            });
        });

        test('should filter out startup and company discussions', () => {
            const startupDiscussions = [
                "My startup focuses on AI technology",
                "How my company works is through subscriptions",
                "What my business model includes",
                "I'm developing a mobile game about space exploration",
                "My project involves creating a social media platform",
            ];

            startupDiscussions.forEach(text => {
                const result = classifier.classify(text);
                expect(result.intent).toBe('business-discussion');
                expect(result.confidence).toBeGreaterThan(0.9);
            });
        });

        test('should filter out personal planning discussions', () => {
            const planningDiscussions = [
                "What I'm planning is a fitness tracking application",
                "How I will implement this feature",
                "Where I will host my application",
                "When I will launch my product",
                "What features I'm adding to my app",
            ];

            planningDiscussions.forEach(text => {
                const result = classifier.classify(text);
                expect(result.intent).toBe('business-discussion');
                expect(result.confidence).toBeGreaterThan(0.9);
            });
        });
    });

    describe('General Knowledge Questions Should Still Work', () => {
        test('should correctly classify legitimate general knowledge questions', () => {
            const generalKnowledgeQuestions = [
                "What is economics?",
                "How do tariffs work?",
                "What are the principles of economics?",
                "How does the economy work?",
                "What is the largest trading card game?",
                "What is the history of trading cards?",
            ];

            generalKnowledgeQuestions.forEach(text => {
                const result = classifier.classify(text);
                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });

        test('should not filter general questions about business concepts', () => {
            const conceptQuestions = [
                "What is a startup?",
                "How do businesses work?",
                "What are the types of companies?",
                "How does entrepreneurship work?",
                "What is venture capital?",
            ];

            conceptQuestions.forEach(text => {
                const result = classifier.classify(text);
                // Should be general-knowledge, not business-discussion
                expect(result.intent).not.toBe('business-discussion');
            });
        });
    });

    describe('Edge Cases', () => {
        test('should handle mixed patterns correctly', () => {
            const edgeCases = [
                // Should be business-discussion
                { text: "Can you tell me what the best platform is for my business?", expected: 'business-discussion' },
                {
                    text: "What do you think about my idea for a card trading platform?",
                    expected: 'business-discussion',
                },

                // Should NOT be business-discussion
                { text: "What is the best trading platform?", expected: 'general-knowledge' },
                { text: "How do trading platforms work?", expected: 'general-knowledge' },
            ];

            edgeCases.forEach(({ text, expected }) => {
                const result = classifier.classify(text);
                if (expected === 'business-discussion') {
                    expect(result.intent).toBe('business-discussion');
                } else {
                    expect(result.intent).not.toBe('business-discussion');
                }
            });
        });

        test('should not trigger on questions without personal context', () => {
            const impersonalQuestions = [
                "What does this platform do?",
                "How does the system work?",
                "What are the features of trading platforms?",
                "How much does it cost to build software?",
            ];

            impersonalQuestions.forEach(text => {
                const result = classifier.classify(text);
                // Should not be classified as business-discussion
                expect(result.intent).not.toBe('business-discussion');
            });
        });
    });

    describe('Confidence and Method Validation', () => {
        test('should return high confidence for business discussions', () => {
            const result = classifier.classify("What I want to build is a trading platform");
            expect(result.confidence).toBe(0.95);
            expect(result.method).toBe('keyword');
        });

        test('should prevent general knowledge classification for business discussions', () => {
            // This pattern used to trigger general-knowledge classification
            const problematicPattern = "What tariffs mean for my trading platform";
            const result = classifier.classify(problematicPattern);

            expect(result.intent).toBe('business-discussion');
            expect(result.confidence).toBe(0.95);
            // Should not trigger assistant response
            expect(result.confidence > 0.5 && result.intent === 'general-knowledge').toBe(false);
        });
    });

    describe('Detailed Classification Analysis', () => {
        test('should provide detailed classification for business discussions', () => {
            const text = "How I plan to build my trading card platform";
            const detailed = classifier.getDetailedClassification(text);

            expect(detailed.final.intent).toBe('business-discussion');
            expect(detailed.final.confidence).toBe(0.95);
            expect(detailed.final.method).toBe('keyword');
            expect(detailed.keyword.intent).toBe('business-discussion');
        });
    });
});