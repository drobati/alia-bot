#!/usr/bin/env tsx
// Test the specific Discord questions that were missed to verify fix

import { HybridClassifier } from '../src/utils/hybrid-classifier';

const hybridClassifier = new HybridClassifier();

const testCases = [
    // Questions that should now work (were previously missed)
    { text: "How many seconds are in a minute?", expected: "general-knowledge", previousConfidence: 0.466 },
    { text: "How do tariffs work?", expected: "general-knowledge", previousConfidence: 0.466 },
    { text: "When is noon?", expected: "general-knowledge", previousConfidence: 0.466 },
    
    // Questions that were correctly working before
    { text: "How tall is the tallest building in the world?", expected: "general-knowledge", previousConfidence: 0.9 },
    { text: "What's the biggest bone in the body?", expected: "general-knowledge", previousConfidence: 0.9 },
    
    // Question that should continue to be filtered out
    { text: "Where am I right now?", expected: "real-time-knowledge", previousConfidence: 0.7 },
];

console.log('🧪 Testing Discord Missed Questions Fix\n');

let allPassed = true;

testCases.forEach((testCase, index) => {
    const result = hybridClassifier.classify(testCase.text);
    const isCorrect = result.intent === testCase.expected;
    const meetsThreshold = result.confidence >= 0.5;
    
    if (!isCorrect) allPassed = false;
    
    console.log(`Test ${index + 1}: "${testCase.text}"`);
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Got: ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`  Previous confidence: ${testCase.previousConfidence}`);
    console.log(`  Improvement: ${result.confidence >= testCase.previousConfidence ? '✅ Better/Same' : '❌ Worse'}`);
    console.log(`  Meets 0.5 threshold: ${meetsThreshold ? '✅ YES' : '❌ NO'}`);
    console.log(`  Correct classification: ${isCorrect ? '✅ YES' : '❌ NO'}`);
    console.log();
});

console.log(`📊 Overall Result: ${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);

// Test additional edge cases for the new patterns
console.log('🔍 Testing Additional Time/Economics Questions:\n');

const additionalTests = [
    "How many minutes are in an hour?",
    "How do taxes work?",
    "When is midnight?",
    "What is economics?",
    "How many days are in a year?",
    "How does the government work?",
];

additionalTests.forEach((question, index) => {
    const result = hybridClassifier.classify(question);
    console.log(`${index + 1}. "${question}"`);
    console.log(`   → ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`   → ${result.confidence >= 0.5 ? '✅' : '❌'} Meets threshold\n`);
});