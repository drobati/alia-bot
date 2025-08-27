// Hybrid keyword + ML classifier for better accuracy
// Combines simple keyword patterns with Bayesian classification

import natural from 'natural';
import fs from 'fs';
import path from 'path';

interface ClassificationResult {
    intent: string;
    confidence: number;
    method: 'keyword' | 'bayesian' | 'fallback';
}

interface TrainingExample {
    category: string;
    text: string;
}

export class HybridClassifier {
    private bayesClassifier: natural.BayesClassifier;
    private trainingData: TrainingExample[] = [];

    constructor() {
        this.bayesClassifier = new natural.BayesClassifier();
        this.loadTrainingData();
        this.trainClassifier();
    }

    private loadTrainingData() {
        const classifiersPath = path.join(process.cwd(), 'src/data/classifiers.json');
        this.trainingData = JSON.parse(fs.readFileSync(classifiersPath, 'utf-8'));
    }

    private trainClassifier() {
        this.trainingData.forEach(item => {
            this.bayesClassifier.addDocument(item.text, item.category);
        });
        this.bayesClassifier.train();
    }

    public classify(message: string): ClassificationResult {
        // First, try keyword-based classification for high-confidence matches
        const keywordResult = this.keywordClassifier(message);
        if (keywordResult.confidence > 0.8) {
            return keywordResult;
        }

        // Fall back to Bayesian classifier
        const bayesianResult = this.bayesianClassifier(message);
        
        // If Bayesian confidence is too low, try keyword as backup with lower threshold
        if (bayesianResult.confidence < 0.1 && keywordResult.confidence > 0.4) {
            return { ...keywordResult, method: 'keyword' };
        }

        return bayesianResult;
    }

    private keywordClassifier(message: string): ClassificationResult {
        const content = message.toLowerCase().trim();
        
        // High-confidence general knowledge patterns
        if (this.isGeneralKnowledgeQuestion(content)) {
            return { intent: 'general-knowledge', confidence: 0.9, method: 'keyword' };
        }

        // High-confidence technical question patterns
        if (this.isTechnicalQuestion(content)) {
            return { intent: 'technical-question', confidence: 0.85, method: 'keyword' };
        }

        // Command patterns
        if (this.isCommand(content)) {
            return { intent: 'command', confidence: 0.8, method: 'keyword' };
        }

        // Small talk patterns
        if (this.isSmallTalk(content)) {
            return { intent: 'small-talk', confidence: 0.75, method: 'keyword' };
        }

        // Real-time knowledge (current events)
        if (this.isRealTimeKnowledge(content)) {
            return { intent: 'real-time-knowledge', confidence: 0.7, method: 'keyword' };
        }

        // Feedback patterns
        if (this.isFeedback(content)) {
            return { intent: 'feedback', confidence: 0.65, method: 'keyword' };
        }

        return { intent: 'unknown', confidence: 0.0, method: 'keyword' };
    }

    private bayesianClassifier(message: string): ClassificationResult {
        // Filter out gibberish/nonsense input
        const words = message.toLowerCase().trim().split(/\s+/);
        const hasOnlyGibberish = words.every(word => 
            word.length < 3 || !/[aeiou]/i.test(word) || /^[^a-z]*$/i.test(word)
        );
        
        if (hasOnlyGibberish && words.length < 4) {
            return { intent: 'unknown', confidence: 0.0, method: 'bayesian' };
        }
        
        const classifications = this.bayesClassifier.getClassifications(message);
        const topClassification = classifications[0];
        
        if (!topClassification) {
            return { intent: 'unknown', confidence: 0.0, method: 'bayesian' };
        }

        return {
            intent: topClassification.label,
            confidence: topClassification.value,
            method: 'bayesian'
        };
    }

    // General knowledge question patterns
    private isGeneralKnowledgeQuestion(content: string): boolean {
        // Skip if it's clearly about current events
        if (content.includes('current') && (content.includes('president') || content.includes('leader'))) {
            return false;
        }
        
        const questionWords = ['what', 'who', 'when', 'where', 'which', 'how many', 'how much'];
        const knowledgeTopics = [
            'capital', 'country', 'countries', 'author', 'wrote', 'painted', 'invented', 
            'discovered', 'mountain', 'river', 'ocean', 'continent', 'planet', 'solar system',
            'war', 'battle', 'history', 'historical', 'century', 'year', 'date',
            'chemical', 'element', 'symbol', 'formula', 'science', 'physics', 'biology', 'chemistry',
            'book', 'novel', 'movie', 'film', 'actor', 'actress', 'director', 'song', 'band', 'artist',
            'sport', 'team', 'player', 'championship', 'olympic', 'record',
            'food', 'dish', 'cuisine', 'ingredient', 'recipe',
            'animal', 'species', 'mammal', 'bird', 'insect', 'habitat',
            'tallest', 'largest', 'smallest', 'fastest', 'longest', 'highest', 'biggest'
        ];

        const hasQuestionWord = questionWords.some(word => content.includes(word));
        const hasKnowledgeTopic = knowledgeTopics.some(topic => content.includes(topic));
        const endsWithQuestionMark = content.endsWith('?');

        // High confidence if it has question word + knowledge topic + question mark
        if (hasQuestionWord && hasKnowledgeTopic && endsWithQuestionMark) {
            return true;
        }

        // Medium confidence patterns
        if ((hasQuestionWord || endsWithQuestionMark) && hasKnowledgeTopic) {
            return true;
        }

        return false;
    }

    // Technical question patterns
    private isTechnicalQuestion(content: string): boolean {
        const techTerms = [
            'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'html', 'css', 'react', 
            'node', 'nodejs', 'npm', 'git', 'github', 'database', 'sql', 'mongodb', 'api',
            'function', 'variable', 'class', 'object', 'array', 'loop', 'algorithm', 'code',
            'programming', 'development', 'debug', 'error', 'exception', 'syntax', 'compile',
            'framework', 'library', 'package', 'module', 'import', 'export', 'async', 'await'
        ];

        const questionWords = ['how do i', 'how to', 'how can i', 'what is', 'what\'s', 'why does', 'why is'];
        
        const hasTechTerm = techTerms.some(term => content.includes(term));
        const hasQuestionPattern = questionWords.some(pattern => content.includes(pattern));

        return hasTechTerm && (hasQuestionPattern || content.endsWith('?'));
    }

    // Command patterns
    private isCommand(content: string): boolean {
        const commandWords = [
            'write', 'create', 'build', 'make', 'generate', 'give me', 'help me',
            'can you', 'could you', 'would you',
            'example', 'tutorial', 'guide', 'step by step', 'implement', 'code'
        ];
        
        // Prioritize "show me" as command over technical question
        if (content.includes('show me')) {
            return true;
        }
        
        // Check for "show me how to" pattern specifically
        if (content.includes('show me how to') || content.includes('show me how')) {
            return true;
        }
        
        // "explain" and "describe" could be commands or technical questions
        // Use context to decide: if it's about a concept/topic, it's a command
        if (content.includes('explain') || content.includes('describe') || content.includes('tell me')) {
            const conceptWords = ['concept', 'difference', 'how', 'what', 'why'];
            return conceptWords.some(concept => content.includes(concept));
        }

        return commandWords.some(cmd => content.includes(cmd));
    }

    // Small talk patterns
    private isSmallTalk(content: string): boolean {
        const greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon',
            'how are you', 'how\'s it going', 'what\'s up', 'sup', 'yo',
            'good day', 'greetings', 'howdy'
        ];

        const casualPhrases = [
            'nice weather', 'beautiful day', 'hot outside', 'cold today', 'raining',
            'weekend', 'friday', 'monday', 'coffee', 'tired', 'hungry',
            'how was your', 'having a good', 'hope you\'re'
        ];

        const hasGreeting = greetings.some(greeting => content.includes(greeting));
        const hasCasualPhrase = casualPhrases.some(phrase => content.includes(phrase));
        
        // Check for emoji presence (casual indicator)
        const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(content);

        return hasGreeting || hasCasualPhrase || (hasEmoji && content.length < 50);
    }

    // Real-time knowledge patterns (current events, current people)
    private isRealTimeKnowledge(content: string): boolean {
        // Check for current authority figures first (higher priority)
        const authorityFigures = ['president', 'prime minister', 'leader', 'ceo', 'mayor'];
        const hasCurrentAndAuthority = content.includes('current') && 
            authorityFigures.some(figure => content.includes(figure));
        
        if (hasCurrentAndAuthority) return true;
        
        // Check specific current president/leader patterns (case insensitive)
        const currentLeaderPatterns = [
            'current president', 'who is the president', 'president of the united states',
            'the current president', 'the president of', 'current us president'
        ];
        
        if (currentLeaderPatterns.some(pattern => content.includes(pattern))) {
            return true;
        }
        
        const currentIndicators = [
            'now', 'today', 'this year', '2024', '2025', 'latest',
            'who is the prime minister', 'current leader', 'what\'s happening now'
        ];

        return currentIndicators.some(indicator => content.includes(indicator));
    }

    // Feedback patterns
    private isFeedback(content: string): boolean {
        const feedbackIndicators = [
            'i think', 'i believe', 'in my opinion', 'suggestion', 'recommend',
            'could be better', 'improvement', 'bug', 'issue', 'problem',
            'love this', 'hate this', 'really good', 'really bad', 'awesome', 'terrible',
            'slow', 'fast', 'laggy', 'crashes', 'broken', 'needs improvement',
            'this app', 'the app', 'the interface', 'the system', 'the website',
            'really slow', 'too slow', 'very slow', 'super slow',
            'i love', 'i hate', 'love the', 'hate the',
            'is really slow', 'is slow', 'is fast', 'is laggy'
        ];

        return feedbackIndicators.some(indicator => content.includes(indicator));
    }

    // Get detailed classification info for debugging
    public getDetailedClassification(message: string) {
        const keywordResult = this.keywordClassifier(message);
        const bayesianResult = this.bayesianClassifier(message);
        const finalResult = this.classify(message);

        return {
            message: message.slice(0, 100),
            keyword: keywordResult,
            bayesian: bayesianResult,
            final: finalResult,
            bayesianTop5: this.bayesClassifier.getClassifications(message).slice(0, 5)
        };
    }
}