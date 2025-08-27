#!/usr/bin/env tsx
// Diagnose issues with the Natural.js Bayesian classifier

import fs from 'fs';
import path from 'path';
import natural from 'natural';

interface TrainingExample {
    category: string;
    text: string;
}

function analyzeClassifier() {
    console.log('🔬 Diagnosing Natural.js Bayesian Classifier Issues\n');
    
    // Load and analyze training data
    const classifiersPath = path.join(process.cwd(), 'src/data/classifiers.json');
    const classifiers = JSON.parse(fs.readFileSync(classifiersPath, 'utf-8')) as TrainingExample[];
    
    console.log('📊 Training Data Analysis:');
    console.log(`  Total examples: ${classifiers.length}`);
    
    const categoryStats = new Map<string, number>();
    classifiers.forEach(item => {
        categoryStats.set(item.category, (categoryStats.get(item.category) || 0) + 1);
    });
    
    console.log('  Category distribution:');
    Array.from(categoryStats.entries()).forEach(([category, count]) => {
        const percentage = ((count / classifiers.length) * 100).toFixed(1);
        console.log(`    - ${category}: ${count} examples (${percentage}%)`);
    });
    
    // Create and train classifier
    console.log('\n🧠 Training Classifier...');
    const classifier = new natural.BayesClassifier();
    
    classifiers.forEach(item => {
        classifier.addDocument(item.text, item.category);
    });
    
    classifier.train();
    console.log('✅ Classifier trained');
    
    // Test with exact training examples
    console.log('\n🎯 Testing Exact Training Examples:');
    const testExamples = [
        'What is the capital of France?',
        'What is the tallest mountain in the world?',
        'Who wrote the novel \'1984\'?',
        'Good morning!',
        'Hello, how are you?'
    ];
    
    testExamples.forEach((text, index) => {
        console.log(`\nTest ${index + 1}: "${text}"`);
        
        // Get classifications
        const classifications = classifier.getClassifications(text);
        const topIntent = classifications[0]?.label;
        const topConfidence = classifications[0]?.value || 0;
        
        console.log(`  Top prediction: ${topIntent} (confidence: ${topConfidence.toFixed(6)})`);
        console.log('  All predictions:');
        classifications.slice(0, 3).forEach((c, i) => {
            console.log(`    ${i + 1}. ${c.label}: ${c.value.toFixed(6)}`);
        });
        
        // Check if this exact text exists in training data
        const exactMatch = classifiers.find(item => item.text === text);
        if (exactMatch) {
            console.log(`  ✅ Exact match found in training data: ${exactMatch.category}`);
        } else {
            console.log(`  ❌ No exact match in training data`);
        }
    });
    
    // Test probability calculations manually
    console.log('\n🔍 Manual Probability Analysis:');
    
    // Get the classifier's internal state
    console.log('Categories in classifier:', classifier.docs?.categories || 'Not available');
    console.log('Vocabulary size:', classifier.vocabulary?.length || 'Not available');
    
    // Test with a very simple example
    const simpleTest = 'capital';
    console.log(`\nTesting simple word: "${simpleTest}"`);
    const simpleClassifications = classifier.getClassifications(simpleTest);
    simpleClassifications.slice(0, 3).forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.label}: ${c.value.toFixed(6)}`);
    });
    
    // Test word frequency analysis
    console.log('\n📝 Word Analysis:');
    const testPhrase = 'What is the capital of France?';
    const tokens = natural.WordTokenizer().tokenize(testPhrase.toLowerCase());
    console.log(`Tokens: ${tokens?.join(', ') || 'None'}`);
    
    // Count how often key words appear in each category
    const wordAnalysis = new Map<string, Map<string, number>>();
    
    classifiers.forEach(item => {
        const categoryWords = wordAnalysis.get(item.category) || new Map();
        const itemTokens = natural.WordTokenizer().tokenize(item.text.toLowerCase());
        
        itemTokens?.forEach(token => {
            categoryWords.set(token, (categoryWords.get(token) || 0) + 1);
        });
        
        wordAnalysis.set(item.category, categoryWords);
    });
    
    // Show word frequency for "what" across categories
    console.log('\nWord "what" frequency by category:');
    wordAnalysis.forEach((words, category) => {
        const whatCount = words.get('what') || 0;
        const totalWords = Array.from(words.values()).reduce((sum, count) => sum + count, 0);
        const percentage = totalWords > 0 ? ((whatCount / totalWords) * 100).toFixed(2) : '0.00';
        console.log(`  ${category}: ${whatCount} occurrences (${percentage}% of category words)`);
    });
    
    console.log('\n🎯 Recommendations:');
    console.log('1. Natural.js Bayesian classifier may be underpowered for this task');
    console.log('2. Consider implementing keyword-based fallback patterns');
    console.log('3. Try OpenAI embeddings for semantic similarity matching');
    console.log('4. Implement hybrid approach: keywords + ML for better accuracy');
}

analyzeClassifier();