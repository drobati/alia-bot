#!/usr/bin/env tsx
// Clean up fragmented categories in training data

import fs from 'fs';
import path from 'path';

interface TrainingExample {
    category: string;
    text: string;
}

// Category mapping to consolidate fragmented categories
const categoryMapping = new Map<string, string>([
    // Command subcategories -> command
    ['code examples', 'command'],
    ['tutorials', 'command'], 
    ['concepts', 'command'],
    ['code reviews', 'command'],
    ['project setup', 'command'],
    ['API usage', 'command'],
    ['algorithms', 'command'],
    ['code translations', 'command'],
    ['optimizations', 'command'],
    
    // Feedback subcategories -> feedback
    ['App feedback', 'feedback'],
    ['Service complaint', 'feedback'],
    ['Improvement suggestion', 'feedback'],
    ['Bug report', 'feedback'],
    ['User experience comment', 'feedback'],
    ['Feature request', 'feedback'],
    ['Performance complaint', 'feedback'],
    ['Design feedback', 'feedback'],
    ['Service praise', 'feedback'],
    ['Performance praise', 'feedback']
]);

function cleanTrainingData() {
    console.log('🧹 Cleaning up fragmented training data categories...');
    
    const inputPath = path.join(process.cwd(), 'src/data/classifiers-expanded.json');
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as TrainingExample[];
    
    console.log(`📊 Input: ${data.length} examples`);
    
    // Count categories before cleaning
    const beforeStats = new Map<string, number>();
    data.forEach(item => {
        beforeStats.set(item.category, (beforeStats.get(item.category) || 0) + 1);
    });
    
    console.log('Categories before cleaning:', Array.from(beforeStats.entries()).map(([cat, count]) => `${cat}(${count})`).join(', '));
    
    // Clean up categories
    const cleanedData = data.map(item => ({
        ...item,
        category: categoryMapping.get(item.category) || item.category
    }));
    
    // Count categories after cleaning
    const afterStats = new Map<string, number>();
    cleanedData.forEach(item => {
        afterStats.set(item.category, (afterStats.get(item.category) || 0) + 1);
    });
    
    console.log('Categories after cleaning:', Array.from(afterStats.entries()).map(([cat, count]) => `${cat}(${count})`).join(', '));
    
    // Write cleaned data
    const outputPath = path.join(process.cwd(), 'src/data/classifiers-cleaned.json');
    fs.writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2));
    
    console.log(`✅ Cleaned data written to: ${outputPath}`);
    console.log(`📊 Total examples: ${cleanedData.length}`);
    
    // Expected category distribution
    console.log('\n🎯 Final distribution:');
    const sortedCategories = Array.from(afterStats.entries()).sort((a, b) => b[1] - a[1]);
    sortedCategories.forEach(([category, count]) => {
        console.log(`  - ${category}: ${count} examples`);
    });
}

cleanTrainingData();