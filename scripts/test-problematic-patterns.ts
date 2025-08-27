#!/usr/bin/env tsx
// Test specific patterns that might have caused the original business discussion issue

import { HybridClassifier } from '../src/utils/hybrid-classifier';

const hybridClassifier = new HybridClassifier();

const problematicPatterns = [
    // Patterns that might trigger due to question words + economics terms
    "What I want to build is a trading platform",
    "How I see this working is through economics",
    "What this platform does is trade items",
    "How the economy works in my game is...",
    "What the government should do for my business",
    "How taxes work in my business model",
    "What tariffs mean for my trading platform",
    "How politics affects my business idea",
    "What economics principles I'm using",
    
    // Patterns with question structure but about personal projects
    "What is my plan? To build a trading card app",
    "How does my system work? Through AI algorithms",
    "What are the features? Card trading and analytics",
    "How much will it cost? Around $50k to develop",
    "When will I launch? Hopefully next year",
    "Where will I host it? On AWS cloud",
    
    // Mixed patterns that could confuse the classifier
    "I want to know how economics works in my trading card game",
    "Can you tell me what the best platform is for my business?",
    "Do you know how much it costs to build a trading system?",
    "What do you think about my idea for a card trading platform?",
    "How would you implement AI in a trading card game?",
];

const legitimateQuestions = [
    "What is economics?",
    "How do tariffs work?", 
    "What are the principles of economics?",
    "How does the economy work?",
    "What is a trading platform?",
    "How do trading cards work?",
];

console.log('🔍 Testing Potentially Problematic Patterns\n');

console.log('🚨 Testing patterns that might be misclassified:');
problematicPatterns.forEach((text, index) => {
    const result = hybridClassifier.classify(text);
    const detailed = hybridClassifier.getDetailedClassification(text);
    
    console.log(`\n${index + 1}. "${text}"`);
    console.log(`   Final: ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`   Keyword: ${detailed.keyword.intent} (${detailed.keyword.confidence.toFixed(3)})`);
    console.log(`   Bayesian: ${detailed.bayesian.intent} (${detailed.bayesian.confidence.toFixed(3)})`);
    console.log(`   Would trigger response: ${result.confidence > 0.5 && result.intent === 'general-knowledge' ? '🚫 YES - PROBLEM!' : '✅ No'}`);
});

console.log('\n\n✅ Legitimate questions for comparison:');
legitimateQuestions.forEach((text, index) => {
    const result = hybridClassifier.classify(text);
    
    console.log(`\n${index + 1}. "${text}"`);
    console.log(`   Final: ${result.intent} (${result.confidence.toFixed(3)}, ${result.method})`);
    console.log(`   Would trigger response: ${result.confidence > 0.5 && result.intent === 'general-knowledge' ? '✅ YES' : '❌ No'}`);
});

const problemCases = problematicPatterns.filter(text => {
    const result = hybridClassifier.classify(text);
    return result.confidence > 0.5 && result.intent === 'general-knowledge';
});

console.log(`\n📊 Summary: ${problemCases.length} potentially problematic patterns found`);
if (problemCases.length > 0) {
    console.log('🚨 These need business discussion filtering:');
    problemCases.forEach(text => console.log(`   - "${text}"`));
}