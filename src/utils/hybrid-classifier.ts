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
    private regexCache = new Map<string, RegExp>();

    // Static constants to avoid array recreation on every method call
    private static readonly QUESTION_WORDS = [
        'what', 'who', 'when', 'where', 'which', 'how many', 'how much', 'how do', 'how does',
        'does', 'is', 'are', 'was', 'were', 'will', 'can', 'could', 'should', 'would',
    ];
    private static readonly KNOWLEDGE_TOPICS = [
        'capital', 'country', 'countries', 'author', 'wrote', 'painted', 'invented',
        'discovered', 'mountain', 'river', 'ocean', 'continent', 'planet', 'solar system',
        'war', 'battle', 'history', 'historical', 'century', 'year', 'date',
        'chemical', 'element', 'symbol', 'formula', 'science', 'physics', 'biology', 'chemistry',
        'book', 'novel', 'movie', 'film', 'actor', 'actress', 'director', 'song', 'band', 'artist',
        'sport', 'team', 'player', 'championship', 'olympic', 'record',
        // Gaming and video games
        'game', 'games', 'video game', 'gaming', 'gamer', 'console', 'pc gaming',
        'moba', 'fps', 'rpg', 'mmo', 'rts', 'indie game', 'arcade',
        'dota', 'dota2', 'league of legends', 'minecraft', 'fortnite', 'valorant', 'overwatch',
        'nintendo', 'playstation', 'xbox', 'steam', 'esports', 'tournament',
        'food', 'dish', 'cuisine', 'ingredient', 'recipe',
        'animal', 'species', 'mammal', 'bird', 'insect', 'habitat',
        'tallest', 'largest', 'smallest', 'fastest', 'longest', 'highest', 'biggest',
        // Time and measurement concepts
        'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years',
        'noon', 'midnight', 'time', 'clock', 'calendar',
        // Economics and government concepts
        'tariffs', 'taxes', 'economics', 'government', 'policy', 'trade', 'economy',
        'politics', 'law', 'constitution', 'democracy', 'republic',
        // Basic math and measurement
        'math', 'mathematics', 'calculation', 'measurement', 'unit', 'metric',
        // Arithmetic operators and terms (using word boundaries for + and - to prevent false positives)
        '×', '÷', 'plus', 'minus', 'times', 'divided', 'add', 'subtract', 'multiply',
        'equals', 'sum', 'difference', 'product', 'quotient', 'arithmetic',
        // Colors and visual concepts
        'color', 'colour', 'white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
        'pink', 'brown', 'gray', 'grey', 'silver', 'gold',
        // Religious and cultural concepts
        'bible', 'quran', 'torah', 'religion', 'god', 'jesus', 'prophet', 'church', 'mosque', 'temple',
        // Geography and places
        'palestine', 'israel', 'america', 'usa', 'europe', 'asia', 'africa', 'antarctica',
        'city', 'state', 'nation', 'population', 'border',
        // Demographics and statistics
        'common', 'popular', 'frequent', 'name', 'names', 'statistics', 'census', 'demographic',
        'most', 'least', 'average', 'typical', 'standard',
        // Technology and computing (basic terms)
        'nlp', 'ai', 'computer', 'internet', 'website', 'email', 'software', 'hardware',
        'algorithm', 'data', 'digital', 'technology',
    ];

    // Regex patterns for knowledge topics (space boundaries to prevent false positives)
    private static readonly KNOWLEDGE_REGEX_PATTERNS = [
        /\s\+\s/,  // Plus symbol with spaces around it
        /\s-\s/,   // Minus symbol with spaces around it
    ];

    private static readonly TECH_TERMS = [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'html', 'css', 'react',
        'node', 'nodejs', 'npm', 'git', 'github', 'database', 'sql', 'mongodb', 'api',
        'function', 'variable', 'class', 'object', 'array', 'loop', 'algorithm', 'code',
        'programming', 'development', 'debug', 'error', 'exception', 'syntax', 'compile',
        'framework', 'library', 'package', 'module', 'import', 'export', 'async', 'await',
    ];

    private static readonly TECH_QUESTION_WORDS = [
        'how do i', 'how to', 'how can i', 'what is', 'what\'s', 'why does', 'why is',
    ];

    private static readonly COMMAND_WORDS = [
        'write', 'create', 'build', 'make', 'generate', 'give me', 'help me',
        'can you', 'could you', 'would you',
        'example', 'tutorial', 'guide', 'step by step', 'implement', 'code',
    ];

    private static readonly CONCEPT_WORDS = ['concept', 'difference', 'how', 'what', 'why'];

    private static readonly GREETINGS = [
        'hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon',
        'how are you', 'how\'s it going', 'what\'s up', 'sup', 'yo',
        'good day', 'greetings', 'howdy',
    ];

    private static readonly CASUAL_PHRASES = [
        'nice weather', 'beautiful day', 'hot outside', 'cold today', 'raining',
        'weekend', 'friday', 'monday', 'coffee', 'tired', 'hungry',
        'how was your', 'having a good', 'hope you\'re',
    ];

    private static readonly AUTHORITY_FIGURES = ['president', 'prime minister', 'leader', 'ceo', 'mayor'];

    private static readonly CURRENT_LEADER_PATTERNS = [
        'current president', 'who is the president', 'president of the united states',
        'the current president', 'the president of', 'current us president',
    ];

    private static readonly CURRENT_INDICATORS = [
        'now', 'today', 'this year', '2024', '2025', 'latest',
        'who is the prime minister', 'current leader', 'what\'s happening now',
        'what time is it', 'what\'s the time', 'current time',
        'who is online', 'who\'s online', 'who is on', 'who\'s on',
    ];

    private static readonly FEEDBACK_INDICATORS = [
        'i think', 'i believe', 'in my opinion', 'suggestion', 'recommend',
        'could be better', 'improvement', 'bug', 'issue', 'problem',
        'love this', 'hate this', 'really good', 'really bad', 'awesome', 'terrible',
        'slow', 'fast', 'laggy', 'crashes', 'broken', 'needs improvement',
        'this app', 'the app', 'the interface', 'the system', 'the website',
        'really slow', 'too slow', 'very slow', 'super slow',
        'i love', 'i hate', 'love the', 'hate the',
        'is really slow', 'is slow', 'is fast', 'is laggy',
    ];

    private static readonly PERSONAL_INDICATORS = [
        'my business', 'my startup', 'my company', 'my project', 'my platform', 'my app',
        'my system', 'my website', 'my idea', 'my plan', 'my game', 'my product',
        'i want to build', 'i\'m building', 'i\'m working on', 'i\'m developing',
        'i want to create', 'i\'m creating', 'i plan to', 'i will build',
        'i\'m planning', 'i\'m thinking of', 'i want to launch', 'i will launch',
        'here\'s what i want to build', 'what i want to build', 'what i\'m building',
        'what i\'m working on', 'what i\'m planning', 'what i want to create',
        'how i plan to', 'how i will', 'how i\'m building', 'how my business',
        'how my system', 'how my platform', 'how my app',
        'for my business', 'for my startup', 'for my company', 'for my project',
        'in my business', 'in my company', 'in my app', 'in my game',
        // Additional patterns for personal projects/discussions
        'this platform does', 'this system does', 'this app does', 'this website does',
        'i\'m using', 'principles i\'m', 'what i\'m', 'how i\'m', 'where i\'m',
        'features i\'m', 'technology i\'m', 'tools i\'m', 'methods i\'m',
        // Personal hobby, collection, and reflection patterns
        'i have cards', 'i have stuff', 'i own cards', 'i own art', 'my collection', 'my stuff', 'my cards', 'my art',
        'i\'m thinking to myself', 'i\'m thinking about', 'i was thinking',
        'my step-dad has', 'my father has', 'my family has', 'my friend has',
        'i collect', 'i\'m collecting', 'my hobby', 'my hobbies',
        'why own something', 'why have something', 'why keep something',
        // Personal gaming activity patterns
        'can\'t wait to play', 'can\'t wait to kill', 'gonna play', 'going to play',
        'i\'m playing', 'i play', 'i love playing', 'i hate playing',
        'kill in', 'playing in', 'main in', 'ranked in', 'casual in',
        'my main is', 'my character', 'my build', 'my loadout',
        // Personal activity/experience sharing patterns
        'one thing i\'ve been', 'i\'ve been doing', 'i have been doing', 'what i\'ve been doing',
        'i\'ve been using', 'i\'ve been working', 'i\'ve been trying',
        'i\'ve been asking', 'i\'ve been getting', 'i\'ve been making',
    ];

    private static readonly BUSINESS_CONTEXT = [
        'business', 'startup', 'company', 'platform', 'application', 'system',
        'project', 'product', 'service', 'website', 'mobile app', 'web app',
        'marketplace', 'e-commerce', 'software', 'tool', 'solution',
    ];

    private static readonly PERSONAL_QUESTION_PATTERNS = [
        'what should i do for my',
        'how should i build my',
        'when will i launch',
        'where will i host',
        'how much will it cost',
        'what do you think about my',
        'how would you implement',
    ];

    private static readonly PERSONAL_PRONOUNS = ['my ', 'i ', 'i\'m ', 'i\'ll ', 'i\'d '];
    private static readonly QUESTION_STRUCTURE_WORDS = [
        'what ', 'how ', 'when ', 'where ', 'which ',
    ];

    constructor() {
        this.bayesClassifier = new natural.BayesClassifier();
        this.loadTrainingData();
        this.trainClassifier();
    }

    // Helper method to check if a word exists with word boundaries (prevents partial matches)
    private hasWordBoundary(content: string, word: string): boolean {
        let regex = this.regexCache.get(word);
        if (!regex) {
            regex = new RegExp(`\\b${word}\\b`, 'i');
            this.regexCache.set(word, regex);
        }
        return regex.test(content);
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

        // Special handling for real-time knowledge - prioritize keyword result
        // because real-time questions often get misclassified by bayesian
        if (keywordResult.intent === 'real-time-knowledge' && keywordResult.confidence > 0.6) {
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

        // Filter out business/project discussions first (highest priority)
        if (this.isBusinessDiscussion(content)) {
            return { intent: 'business-discussion', confidence: 0.95, method: 'keyword' };
        }

        // Filter out contextual/conversational references (high priority)
        if (this.isContextualReference(content)) {
            return { intent: 'contextual-reference', confidence: 0.85, method: 'keyword' };
        }

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
            word.length < 3 || !/[aeiou]/i.test(word) || /^[^a-z]*$/i.test(word),
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
            method: 'bayesian',
        };
    }

    // General knowledge question patterns
    private isGeneralKnowledgeQuestion(content: string): boolean {
        // Skip if it's clearly about current events or real-time knowledge
        if (content.includes('current') && (content.includes('president') || content.includes('leader'))) {
            return false;
        }

        // Skip if it's a real-time knowledge question (to prevent keyword conflicts)
        if (this.isRealTimeKnowledge(content)) {
            return false;
        }

        const hasQuestionWord = HybridClassifier.QUESTION_WORDS.some(word => content.includes(word));
        const hasKnowledgeTopic = HybridClassifier.KNOWLEDGE_TOPICS.some(topic =>
            this.hasWordBoundary(content, topic)) ||
            HybridClassifier.KNOWLEDGE_REGEX_PATTERNS.some(pattern =>
                pattern.test(content));
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
        const hasTechTerm = HybridClassifier.TECH_TERMS.some(term => content.includes(term));
        const hasQuestionPattern = HybridClassifier.TECH_QUESTION_WORDS.some(pattern => content.includes(pattern));

        return hasTechTerm && (hasQuestionPattern || content.endsWith('?'));
    }

    // Command patterns
    private isCommand(content: string): boolean {

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
            return HybridClassifier.CONCEPT_WORDS.some(concept => content.includes(concept));
        }

        return HybridClassifier.COMMAND_WORDS.some(cmd => content.includes(cmd));
    }

    // Small talk patterns
    private isSmallTalk(content: string): boolean {
        const hasGreeting = HybridClassifier.GREETINGS.some(greeting => content.includes(greeting));
        const hasCasualPhrase = HybridClassifier.CASUAL_PHRASES.some(phrase => content.includes(phrase));

        // Check for emoji presence (casual indicator)
        const emojiPatterns = [
            '[\u{1F600}-\u{1F64F}]', // emoticons
            '[\u{1F300}-\u{1F5FF}]', // misc symbols
            '[\u{1F680}-\u{1F6FF}]', // transport symbols
            '[\u{1F1E0}-\u{1F1FF}]', // flags
            '[\u{2600}-\u{26FF}]',   // misc symbols
            '[\u{2700}-\u{27BF}]',   // dingbats
        ];
        const emojiRegex = new RegExp(emojiPatterns.join('|'), 'u');
        const hasEmoji = emojiRegex.test(content);

        return hasGreeting || hasCasualPhrase || (hasEmoji && content.length < 50);
    }

    // Real-time knowledge patterns (current events, current people)
    private isRealTimeKnowledge(content: string): boolean {
        // Check for current authority figures first (higher priority)
        const hasCurrentAndAuthority = content.includes('current') &&
            HybridClassifier.AUTHORITY_FIGURES.some(figure => content.includes(figure));

        if (hasCurrentAndAuthority) {return true;}

        // Check specific current president/leader patterns (case insensitive)
        if (HybridClassifier.CURRENT_LEADER_PATTERNS.some(pattern => content.includes(pattern))) {
            return true;
        }

        return HybridClassifier.CURRENT_INDICATORS.some(indicator => content.includes(indicator));
    }

    // Feedback patterns
    private isFeedback(content: string): boolean {
        return HybridClassifier.FEEDBACK_INDICATORS.some(indicator => content.includes(indicator));
    }

    // Business/project discussion patterns
    private isBusinessDiscussion(content: string): boolean {
        // Check for direct personal business patterns first
        if (HybridClassifier.PERSONAL_INDICATORS.some(indicator => content.includes(indicator))) {
            return true;
        }

        // Check for question patterns about personal projects
        if (HybridClassifier.PERSONAL_QUESTION_PATTERNS.some(pattern => content.includes(pattern))) {
            return true;
        }

        // Check for business context combined with question words about personal projects
        const hasPersonalPronoun = HybridClassifier.PERSONAL_PRONOUNS.some(pronoun =>
            content.includes(pronoun),
        );
        const hasBusinessContext = HybridClassifier.BUSINESS_CONTEXT.some(context => content.includes(context));
        const hasQuestionStructure = HybridClassifier.QUESTION_STRUCTURE_WORDS.some(word =>
            content.includes(word),
        );

        // If it's a question about a personal business/project, filter it out
        if (hasPersonalPronoun && hasBusinessContext && hasQuestionStructure) {
            return true;
        }

        return false;
    }

    // Contextual reference patterns (questions about immediate context, not general knowledge)
    private isContextualReference(content: string): boolean {
        // Patterns that reference unclear context with "this", "that", "here", "there"
        const contextualPatterns = [
            'is this a', 'is this the', 'is that a', 'is that the',
            'what is this', 'what is that', 'what\'s this', 'what\'s that',
            'where is this', 'where is that', 'how is this', 'how is that',
            'is this correct', 'is this right', 'is this wrong',
            'is this good', 'is this bad', 'is this better',
            'what about this', 'what about that', 'how about this', 'how about that',
            'does this', 'can this', 'will this', 'should this',
            'is here a', 'is there a', 'what\'s here', 'what\'s there',
        ];

        return contextualPatterns.some(pattern => content.includes(pattern));
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
            bayesianTop5: this.bayesClassifier.getClassifications(message).slice(0, 5),
        };
    }
}