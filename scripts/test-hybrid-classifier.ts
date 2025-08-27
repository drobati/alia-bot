#!/usr/bin/env tsx
// Test hybrid classifier with various message types

import { HybridClassifier } from '../src/utils/hybrid-classifier';

const hybridClassifier = new HybridClassifier();

const testCases = [
    // General knowledge questions
    { text: "What is the capital of Italy?", expected: "general-knowledge" },
    { text: "Who painted the Mona Lisa?", expected: "general-knowledge" },
    { text: "How many planets are in our solar system?", expected: "general-knowledge" },
    { text: "Which country has the largest population?", expected: "general-knowledge" },
    
    // Technical questions
    { text: "How do I declare a variable in JavaScript?", expected: "technical-question" },
    { text: "What's the difference between let and const?", expected: "technical-question" },
    { text: "How to center a div in CSS?", expected: "technical-question" },
    { text: "Why is my React component not re-rendering?", expected: "technical-question" },
    
    // Commands
    { text: "Write a Python function to calculate factorial", expected: "command" },
    { text: "Show me how to use async/await", expected: "command" },
    { text: "Create a REST API example", expected: "command" },
    { text: "Explain the concept of closures", expected: "command" },
    
    // Small talk
    { text: "Hey everyone, how's your day?", expected: "small-talk" },
    { text: "Good evening friends!", expected: "small-talk" },
    { text: "The weather is nice today ☀️", expected: "small-talk" },
    { text: "Anyone else excited for the weekend?", expected: "small-talk" },
    
    // Real-time knowledge
    { text: "Who is the current president?", expected: "real-time-knowledge" },
    { text: "What's happening now in the news?", expected: "real-time-knowledge" },
    
    // Feedback
    { text: "This app is really slow", expected: "feedback" },
    { text: "I love the new interface design", expected: "feedback" },
    { text: "The notification system needs improvement", expected: "feedback" },
    
    // Edge cases
    { text: "random text without clear intent", expected: "unknown" },
    { text: "asdf qwerty", expected: "unknown" }
];

console.log('🧪 Testing Hybrid Classifier with Various Message Types\n');

let correct = 0;
let total = testCases.length;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase.text}"`);
    
    const result = hybridClassifier.classify(testCase.text);
    const isCorrect = result.intent === testCase.expected;
    
    if (isCorrect) correct++;
    
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Got: ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`  ${isCorrect ? '✅' : '❌'} ${isCorrect ? 'Correct' : 'Incorrect'}\n`);
});

const accuracy = (correct / total * 100).toFixed(1);
console.log(`📊 Results: ${correct}/${total} correct (${accuracy}% accuracy)`);

// Test confidence thresholds
console.log('\n🎯 Confidence Threshold Analysis:');
const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

thresholds.forEach(threshold => {
    const passCount = testCases.filter(testCase => {
        const result = hybridClassifier.classify(testCase.text);
        return result.confidence >= threshold;
    }).length;
    
    const passRate = (passCount / total * 100).toFixed(1);
    console.log(`  Threshold ${threshold}: ${passCount}/${total} messages pass (${passRate}%)`);
});

console.log('\n💡 Recommendation: Use threshold 0.5 for good balance of precision and recall');