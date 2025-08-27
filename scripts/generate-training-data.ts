#!/usr/bin/env tsx
// Generate expanded training data for assistant classifier

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TrainingExample {
    category: string;
    text: string;
}

async function generateGeneralKnowledgeQuestions(count: number = 80): Promise<TrainingExample[]> {
    console.log(`🧠 Generating ${count} general knowledge questions...`);
    
    const prompt = `Generate ${count} diverse general knowledge questions that a Discord user might ask. 
    
    Include questions about:
    - Geography (capitals, countries, landmarks, continents)
    - History (dates, events, historical figures, wars, periods)
    - Science (basic facts, discoveries, natural phenomena, human body)
    - Literature (authors, books, poems, characters)
    - Pop culture (movies, music, celebrities, TV shows)
    - Sports (athletes, teams, records, rules)
    - Food & cooking (cuisines, ingredients, techniques)
    - Animals & nature (species, habitats, behavior)
    - Technology (inventions, inventors, basic concepts)
    - Art (artists, movements, famous works)
    
    Format as JSON array with objects like {"category": "general-knowledge", "text": "What is the capital of Italy?"}
    
    Make questions natural and conversational as they would appear in Discord chat.
    Include variations like: "What is...", "Who was...", "When did...", "Where is...", "How many...", "Which..."
    
    Return ONLY the JSON array, no other text.`;
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 4000
        });
        
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }
        
        const questions = JSON.parse(response) as TrainingExample[];
        console.log(`✅ Generated ${questions.length} general knowledge questions`);
        return questions;
        
    } catch (error) {
        console.error('❌ Failed to generate general knowledge questions:', error);
        return [];
    }
}

async function generateTechnicalQuestions(count: number = 40): Promise<TrainingExample[]> {
    console.log(`💻 Generating ${count} technical questions...`);
    
    const prompt = `Generate ${count} diverse technical questions that a Discord user might ask about programming and technology.
    
    Include questions about:
    - Programming languages (JavaScript, Python, TypeScript, Java, C++, etc.)
    - Web development (HTML, CSS, React, Node.js, databases)
    - Development tools (Git, IDEs, command line, package managers)
    - Software engineering concepts (algorithms, data structures, design patterns)
    - System administration (servers, deployment, cloud services)
    - Mobile development (iOS, Android)
    - Machine learning and AI basics
    - Debugging and troubleshooting
    - Best practices and methodologies
    
    Format as JSON array with objects like {"category": "technical-question", "text": "How do I center a div in CSS?"}
    
    Make questions sound natural and conversational as they would appear in Discord.
    Include variations like "How do I...", "What's the difference between...", "Why does...", "How to..."
    
    Return ONLY the JSON array, no other text.`;
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 3000
        });
        
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }
        
        const questions = JSON.parse(response) as TrainingExample[];
        console.log(`✅ Generated ${questions.length} technical questions`);
        return questions;
        
    } catch (error) {
        console.error('❌ Failed to generate technical questions:', error);
        return [];
    }
}

async function generateCommands(count: number = 30): Promise<TrainingExample[]> {
    console.log(`⚡ Generating ${count} command requests...`);
    
    const prompt = `Generate ${count} diverse command requests that a Discord user might make asking for code, explanations, or tutorials.
    
    Include requests for:
    - Code examples and snippets
    - Tutorials and step-by-step guides
    - Explanations of concepts
    - Code reviews and debugging help
    - Project setup and configuration
    - API usage examples
    - Algorithm implementations
    - Code translations between languages
    - Optimization suggestions
    
    Format as JSON array with objects like {"category": "command", "text": "Write a Python function to sort a list"}
    
    Make requests sound natural and imperative as they would appear in Discord.
    Include variations like "Write...", "Create...", "Show me...", "Explain...", "Generate...", "Build..."
    
    Return ONLY the JSON array, no other text.`;
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 3000
        });
        
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }
        
        const commands = JSON.parse(response) as TrainingExample[];
        console.log(`✅ Generated ${commands.length} commands`);
        return commands;
        
    } catch (error) {
        console.error('❌ Failed to generate commands:', error);
        return [];
    }
}

async function generateSmallTalk(count: number = 25): Promise<TrainingExample[]> {
    console.log(`💬 Generating ${count} small talk examples...`);
    
    const prompt = `Generate ${count} diverse small talk messages that Discord users might send in casual conversation.
    
    Include:
    - Greetings (various times of day)
    - Casual check-ins and how are you
    - Weather comments
    - Weekend/day off comments
    - General social pleasantries
    - Emoji-heavy casual messages
    - Brief personal updates
    - Friendly banter
    - Random observations
    
    Format as JSON array with objects like {"category": "small-talk", "text": "Hey everyone, how's your day going?"}
    
    Make them sound natural and conversational as they would appear in Discord chat.
    Include some with emoji and casual language.
    
    Return ONLY the JSON array, no other text.`;
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9,
            max_tokens: 2500
        });
        
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }
        
        const smallTalk = JSON.parse(response) as TrainingExample[];
        console.log(`✅ Generated ${smallTalk.length} small talk examples`);
        return smallTalk;
        
    } catch (error) {
        console.error('❌ Failed to generate small talk:', error);
        return [];
    }
}

async function generateFeedback(count: number = 15): Promise<TrainingExample[]> {
    console.log(`📝 Generating ${count} feedback examples...`);
    
    const prompt = `Generate ${count} diverse feedback messages that Discord users might send about apps, services, or experiences.
    
    Include:
    - App/website feedback
    - Service complaints or praise
    - Suggestions for improvements
    - Bug reports (general, not technical debugging)
    - User experience comments
    - Feature requests
    - Performance complaints or praise
    - Design feedback
    
    Format as JSON array with objects like {"category": "feedback", "text": "This app is really slow on mobile"}
    
    Make them sound natural as they would appear in Discord.
    Mix positive and negative feedback.
    
    Return ONLY the JSON array, no other text.`;
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 2000
        });
        
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }
        
        const feedback = JSON.parse(response) as TrainingExample[];
        console.log(`✅ Generated ${feedback.length} feedback examples`);
        return feedback;
        
    } catch (error) {
        console.error('❌ Failed to generate feedback:', error);
        return [];
    }
}

async function main() {
    console.log('🚀 Generating expanded training data for assistant classifier\n');
    
    // Load existing data
    const classifiersPath = path.join(process.cwd(), 'src/data/classifiers.json');
    const existingData = JSON.parse(fs.readFileSync(classifiersPath, 'utf-8')) as TrainingExample[];
    
    console.log(`📊 Current training data: ${existingData.length} examples`);
    const categoryStats = new Map<string, number>();
    existingData.forEach(item => {
        categoryStats.set(item.category, (categoryStats.get(item.category) || 0) + 1);
    });
    console.log('Current distribution:', Array.from(categoryStats.entries()).map(([cat, count]) => `${cat}(${count})`).join(', '));
    console.log();
    
    // Generate new training data
    const [generalKnowledge, technical, commands, smallTalk, feedback] = await Promise.all([
        generateGeneralKnowledgeQuestions(80),
        generateTechnicalQuestions(40), 
        generateCommands(30),
        generateSmallTalk(25),
        generateFeedback(15)
    ]);
    
    // Keep existing real-time-knowledge as is (it's correctly minimal)
    const realTimeKnowledge = existingData.filter(item => item.category === 'real-time-knowledge');
    
    // Combine all data
    const allTrainingData = [
        ...generalKnowledge,
        ...technical,
        ...commands,
        ...smallTalk,
        ...feedback,
        ...realTimeKnowledge
    ];
    
    // Calculate new stats
    const newCategoryStats = new Map<string, number>();
    allTrainingData.forEach(item => {
        newCategoryStats.set(item.category, (newCategoryStats.get(item.category) || 0) + 1);
    });
    
    console.log(`\n📊 New training data: ${allTrainingData.length} examples (${((allTrainingData.length / existingData.length - 1) * 100).toFixed(1)}% increase)`);
    console.log('New distribution:', Array.from(newCategoryStats.entries()).map(([cat, count]) => `${cat}(${count})`).join(', '));
    
    // Write new data to file
    const outputPath = path.join(process.cwd(), 'src/data/classifiers-expanded.json');
    fs.writeFileSync(outputPath, JSON.stringify(allTrainingData, null, 2));
    
    console.log(`\n✅ Expanded training data written to: ${outputPath}`);
    console.log('📝 Review the generated data, then rename to classifiers.json to use it');
    
    console.log('\n🎯 Expected improvements:');
    console.log('- General knowledge confidence: 0.06 → 0.6-0.9');
    console.log('- Overall classifier accuracy: Significant improvement');
    console.log('- Reduced false negatives for intended categories');
}

main().catch(console.error);