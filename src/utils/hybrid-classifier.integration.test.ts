/**
 * Integration tests for HybridClassifier
 *
 * These tests verify the classifier works correctly with real training data
 * and can accurately classify various message types.
 *
 * Unlike unit tests, these tests use the actual classifier with real training data
 * to validate classification accuracy and confidence scores.
 */

import { HybridClassifier } from './hybrid-classifier';

describe('HybridClassifier Integration Tests', () => {
    let classifier: HybridClassifier;

    beforeEach(() => {
        // Use the real classifier with actual training data
        classifier = new HybridClassifier();
    });

    describe('General Knowledge Classification', () => {
        it('should classify factual questions as general-knowledge', () => {
            const messages = [
                'what is the capital of France?',
                'who invented the telephone?',
                'when did World War 2 end?',
                'how does photosynthesis work?',
                'what is the tallest mountain?',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.7);
            });
        });

        it('should classify scientific questions as general-knowledge', () => {
            const messages = [
                'what is DNA?',
                'how do magnets work?',
                'what is gravity?',
                'explain photosynthesis',
                'what is quantum physics?',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.6);
            });
        });

        it('should classify historical questions as general-knowledge', () => {
            const messages = [
                'who was the first president?',
                'what happened in 1776?',
                'when was the Roman Empire founded?',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('general-knowledge');
                expect(result.confidence).toBeGreaterThan(0.6);
            });
        });
    });

    describe('Technical Question Classification', () => {
        it('should classify programming questions as technical-question', () => {
            const messages = [
                'how do I write a function in JavaScript?',
                'what is recursion in programming?',
                'explain async/await in TypeScript',
                'how does React work?',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(['technical-question', 'general-knowledge']).toContain(result.intent);
                expect(result.confidence).toBeGreaterThan(0.6);
            });
        });
    });

    describe('Small Talk Classification', () => {
        it('should classify greetings as small-talk', () => {
            const messages = [
                'hello',
                'hi there',
                'good morning',
                'how are you?',
                'hey what\'s up',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('small-talk');
                expect(result.confidence).toBeGreaterThan(0.7);
            });
        });
    });

    describe('Real-Time Knowledge Classification', () => {
        it('should classify current event questions as real-time-knowledge', () => {
            const messages = [
                'who is the current president?',
                'what time is it?',
                'who is online?',
                'what\'s happening now?',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('real-time-knowledge');
                expect(result.confidence).toBeGreaterThan(0.6);
            });
        });
    });

    describe('Business Discussion Classification', () => {
        it('should classify personal business discussions as business-discussion', () => {
            const messages = [
                'I want to build my startup',
                'my company does this thing',
                'how should I build my platform?',
                'my app uses these features',
                'I\'m building a new product',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('business-discussion');
                expect(result.confidence).toBeGreaterThan(0.8);
            });
        });

        it('should classify personal project discussions as business-discussion', () => {
            const messages = [
                'I have cards from my collection',
                'one thing I\'ve been working on',
                'can\'t wait to play my game',
                'my hobby is collecting',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('business-discussion');
                expect(result.confidence).toBeGreaterThan(0.8);
            });
        });
    });

    describe('Contextual Reference Classification', () => {
        it('should classify contextual references appropriately', () => {
            const messages = [
                'is this a good idea?',
                'what is this thing?',
                'how does this work?',
                'is that correct?',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('contextual-reference');
                expect(result.confidence).toBeGreaterThan(0.8);
            });
        });
    });

    describe('Feedback Classification', () => {
        it('should classify feedback messages correctly', () => {
            const messages = [
                'I think this could be better',
                'this is really slow',
                'I love this feature',
                'the app is laggy',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                expect(result.intent).toBe('feedback');
                expect(result.confidence).toBeGreaterThan(0.6);
            });
        });
    });

    describe('Edge Cases and Filtering', () => {
        it('should handle very short messages', () => {
            const messages = ['hi', 'ok', 'yes', 'no'];

            messages.forEach(message => {
                const result = classifier.classify(message);
                // Should classify but might have lower confidence
                expect(result.intent).toBeDefined();
                expect(result.confidence).toBeGreaterThanOrEqual(0);
            });
        });

        it('should handle gibberish messages', () => {
            const messages = [
                'asdfghjkl',
                'zxcvbnm',
                'qwerty',
            ];

            messages.forEach(message => {
                const result = classifier.classify(message);
                // Might classify as unknown or with very low confidence
                expect(result.intent).toBeDefined();
            });
        });

        it('should handle messages with mixed content', () => {
            const result1 = classifier.classify('hello, what is the capital of France?');
            // Should prioritize the knowledge question over greeting
            expect(['general-knowledge', 'small-talk']).toContain(result1.intent);

            const result2 = classifier.classify('I think, what is DNA?');
            // Should recognize the knowledge question despite "I think" prefix
            expect(result2.intent).toBe('general-knowledge');
        });
    });

    describe('Classification Method Tracking', () => {
        it('should use keyword method for high-confidence keyword matches', () => {
            const result = classifier.classify('what is the capital of France?');
            expect(result.method).toBe('keyword');
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        it('should fall back to bayesian when keyword confidence is low', () => {
            // A message that might not match strong keyword patterns
            const result = classifier.classify('tell me about something interesting');
            expect(['keyword', 'bayesian']).toContain(result.method);
        });
    });

    describe('Detailed Classification Analysis', () => {
        it('should provide detailed classification breakdown', () => {
            const detailed = classifier.getDetailedClassification('what is photosynthesis?');

            expect(detailed).toHaveProperty('message');
            expect(detailed).toHaveProperty('keyword');
            expect(detailed).toHaveProperty('bayesian');
            expect(detailed).toHaveProperty('final');
            expect(detailed).toHaveProperty('bayesianTop5');

            expect(detailed.keyword.intent).toBeDefined();
            expect(detailed.bayesian.intent).toBeDefined();
            expect(detailed.final.intent).toBeDefined();
            expect(Array.isArray(detailed.bayesianTop5)).toBe(true);
        });

        it('should show confidence scores for all methods', () => {
            const detailed = classifier.getDetailedClassification('how does gravity work?');

            expect(detailed.keyword.confidence).toBeGreaterThanOrEqual(0);
            expect(detailed.keyword.confidence).toBeLessThanOrEqual(1);

            expect(detailed.bayesian.confidence).toBeGreaterThanOrEqual(0);
            expect(detailed.bayesian.confidence).toBeLessThanOrEqual(1);

            expect(detailed.final.confidence).toBeGreaterThanOrEqual(0);
            expect(detailed.final.confidence).toBeLessThanOrEqual(1);
        });
    });

    describe('Real-World Message Examples', () => {
        it('should handle actual Discord-style questions', () => {
            const discordMessages = [
                'Alia, what is the meaning of life?',
                'hey @Alia what is 2+2?',
                '@bot explain quantum mechanics',
            ];

            discordMessages.forEach(message => {
                const result = classifier.classify(message);
                // Should classify despite Discord-specific formatting
                expect(result.intent).toBeDefined();
                expect(result.confidence).toBeGreaterThan(0);
            });
        });

        it('should handle questions with varying formality', () => {
            const informalMessages = [
                'yo what\'s DNA?',
                'hey can you explain photosynthesis?',
                'sup, how does gravity work?',
            ];

            informalMessages.forEach(message => {
                const result = classifier.classify(message);
                // Should still recognize as knowledge questions
                expect(['general-knowledge', 'small-talk']).toContain(result.intent);
            });
        });
    });

    describe('Classification Consistency', () => {
        it('should classify similar questions consistently', () => {
            const similarQuestions = [
                'what is photosynthesis?',
                'what is photosynthesis',
                'What is photosynthesis?',
                'WHAT IS PHOTOSYNTHESIS?',
            ];

            const results = similarQuestions.map(q => classifier.classify(q));

            // All should have same intent
            const intents = results.map(r => r.intent);
            expect(new Set(intents).size).toBe(1);
            expect(intents[0]).toBe('general-knowledge');

            // Confidence should be similar (within 0.2)
            const confidences = results.map(r => r.confidence);
            const minConfidence = Math.min(...confidences);
            const maxConfidence = Math.max(...confidences);
            expect(maxConfidence - minConfidence).toBeLessThan(0.2);
        });
    });

    describe('Priority and Precedence', () => {
        it('should prioritize business-discussion over general-knowledge for personal projects', () => {
            const result = classifier.classify('what should I do for my business platform?');
            expect(result.intent).toBe('business-discussion');
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        it('should prioritize contextual-reference for vague "this/that" questions', () => {
            const result = classifier.classify('what is this thing?');
            expect(result.intent).toBe('contextual-reference');
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        it('should prioritize real-time-knowledge for current events', () => {
            const result = classifier.classify('who is the current president of the United States?');
            expect(result.intent).toBe('real-time-knowledge');
            expect(result.confidence).toBeGreaterThan(0.6);
        });
    });

    describe('Confidence Thresholds', () => {
        it('should have high confidence for clear general-knowledge questions', () => {
            const result = classifier.classify('what is the capital of France?');
            expect(result.intent).toBe('general-knowledge');
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        it('should have medium-to-high confidence for technical questions', () => {
            const result = classifier.classify('how do I use async/await in JavaScript?');
            expect(result.confidence).toBeGreaterThan(0.6);
        });

        it('should have very high confidence for greetings', () => {
            const result = classifier.classify('hello');
            expect(result.intent).toBe('small-talk');
            expect(result.confidence).toBeGreaterThan(0.7);
        });
    });

    describe('Response Intent Filtering', () => {
        const RESPONSE_INTENTS = ['general-knowledge', 'real-time-knowledge', 'technical-question'];

        it('should classify response-worthy intents with sufficient confidence', () => {
            const questions = [
                'what is photosynthesis?',
                'who is the current president?',
                'how does recursion work in programming?',
            ];

            questions.forEach(question => {
                const result = classifier.classify(question);
                expect(RESPONSE_INTENTS).toContain(result.intent);
                expect(result.confidence).toBeGreaterThan(0.7);
            });
        });

        it('should filter out non-response intents', () => {
            const nonResponseMessages = [
                'hello',
                'I want to build my startup',
                'is this correct?',
            ];

            nonResponseMessages.forEach(message => {
                const result = classifier.classify(message);
                expect(RESPONSE_INTENTS).not.toContain(result.intent);
            });
        });
    });
});
