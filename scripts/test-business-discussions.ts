#!/usr/bin/env tsx
// Test business discussion patterns to understand misclassification

import { HybridClassifier } from '../src/utils/hybrid-classifier';

const hybridClassifier = new HybridClassifier();

const businessDiscussions = [
    // Trading card platform examples (based on the issue)
    "Here's what I want to build. A trading card platform using AI.",
    "I'm building a platform for trading cards with AI integration.",
    "What I want to create is a trading card marketplace.",
    "How I plan to build this is with modern web technology.",
    "I want to make an app for trading card collectors.",
    "This is my business idea: an AI-powered trading card platform.",
    
    // Other business/project discussions
    "I want to build a restaurant app",
    "Here's my startup idea for food delivery",
    "What I'm working on is an e-commerce platform", 
    "How my business works is through subscriptions",
    "I'm developing a mobile game about space exploration",
    "My project involves creating a social media platform",
    "I want to launch a clothing brand online",
    "What I'm planning is a fitness tracking application",
    "I'm thinking of building a podcast platform",
    "Here's what my company does - we provide cloud services"
];

const actualQuestions = [
    // These should still be classified as general knowledge
    "What is the largest trading card game?",
    "How do trading cards work?",
    "What is the history of trading cards?",
    "How does AI work?",
    "What is a platform?",
    "How does e-commerce work?"
];

console.log('🔍 Testing Business Discussion Classification\n');

console.log('❌ Business discussions that SHOULD NOT trigger responses:');
businessDiscussions.forEach((text, index) => {
    const result = hybridClassifier.classify(text);
    const detailed = hybridClassifier.getDetailedClassification(text);
    
    console.log(`\n${index + 1}. "${text}"`);
    console.log(`   Final: ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`   Keyword: ${detailed.keyword.intent} (${detailed.keyword.confidence.toFixed(3)})`);
    console.log(`   Bayesian: ${detailed.bayesian.intent} (${detailed.bayesian.confidence.toFixed(3)})`);
    console.log(`   Would trigger response: ${result.confidence > 0.5 && result.intent === 'general-knowledge' ? '🚫 YES - PROBLEM!' : '✅ No'}`);
});

console.log('\n\n✅ Questions that SHOULD still work:');
actualQuestions.forEach((text, index) => {
    const result = hybridClassifier.classify(text);
    
    console.log(`\n${index + 1}. "${text}"`);
    console.log(`   Final: ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`   Would trigger response: ${result.confidence > 0.5 && result.intent === 'general-knowledge' ? '✅ YES' : '❌ No'}`);
});

console.log('\n📊 Analysis Summary:');
const problemCases = businessDiscussions.filter(text => {
    const result = hybridClassifier.classify(text);
    return result.confidence > 0.5 && result.intent === 'general-knowledge';
});

console.log(`Business discussions incorrectly classified: ${problemCases.length}/${businessDiscussions.length}`);
if (problemCases.length > 0) {
    console.log('🚨 These patterns need filtering to prevent incorrect responses');
}