#!/usr/bin/env tsx
// Test the specific questions that were missed in Discord

import { HybridClassifier } from '../src/utils/hybrid-classifier';

const hybridClassifier = new HybridClassifier();

const missedQuestions = [
    "Where am I right now?",
    "How many seconds are in a minute?", 
    "How do tariffs work?",
    "When is noon?"
];

const workingQuestions = [
    "How tall is the tallest building in the world?",
    "What's the biggest bone in the body?"
];

console.log('🔍 Testing Missed Questions from Discord\n');

console.log('❌ Questions that were MISSED:');
missedQuestions.forEach((question, index) => {
    const result = hybridClassifier.getDetailedClassification(question);
    console.log(`\n${index + 1}. "${question}"`);
    console.log(`   Final: ${result.final.intent} (${result.final.confidence}, ${result.final.method})`);
    console.log(`   Keyword: ${result.keyword.intent} (${result.keyword.confidence})`);
    console.log(`   Bayesian: ${result.bayesian.intent} (${result.bayesian.confidence})`);
    console.log(`   Meets 0.5 threshold: ${result.final.confidence > 0.5 ? '✅ YES' : '❌ NO'}`);
});

console.log('\n\n✅ Questions that WORKED:');
workingQuestions.forEach((question, index) => {
    const result = hybridClassifier.getDetailedClassification(question);
    console.log(`\n${index + 1}. "${question}"`);
    console.log(`   Final: ${result.final.intent} (${result.final.confidence}, ${result.final.method})`);
    console.log(`   Keyword: ${result.keyword.intent} (${result.keyword.confidence})`);
    console.log(`   Bayesian: ${result.bayesian.intent} (${result.bayesian.confidence})`);
    console.log(`   Meets 0.5 threshold: ${result.final.confidence > 0.5 ? '✅ YES' : '❌ NO'}`);
});

console.log('\n🎯 Analysis Summary:');
console.log('The missed questions likely need additional keyword patterns in the hybrid classifier.');
console.log('Focus areas:');
console.log('- Time/math questions: "how many", "when is"');
console.log('- Economics: "tariffs", "work"');  
console.log('- Location questions: may be classified as real-time-knowledge (not processed)');