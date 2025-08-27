import fs from 'fs';
import path from 'path';
import natural from 'natural';
import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';

const classifier = new natural.BayesClassifier();

const classifiersFilePath = path.join(process.cwd(), 'src/data/classifiers.json');
const classifiersData = fs.readFileSync(classifiersFilePath, 'utf-8');
const classifiers = JSON.parse(classifiersData);

// Track categories for logging
const categoryStats = new Map<string, number>();

classifiers.forEach((classifierData: { text: string, category: string }) => {
    classifier.addDocument(classifierData.text, classifierData.category);
    
    // Count categories for stats
    const current = categoryStats.get(classifierData.category) || 0;
    categoryStats.set(classifierData.category, current + 1);
});

classifier.train();

// Log classifier initialization (this will show in startup logs)
console.log('🤖 Assistant classifier trained with', {
    totalDocuments: classifiers.length,
    categories: Array.from(categoryStats.entries()).map(([category, count]) => `${category}(${count})`),
    hasGeneralKnowledge: categoryStats.has('general-knowledge'),
    generalKnowledgeExamples: categoryStats.get('general-knowledge') || 0
});

export default async (message: Message, context: Context) => {
    if (message.author.bot) {
        return;
    }

    const startTime = Date.now();
    const isDebugMode = process.env.ASSISTANT_DEBUG === 'true';
    
    try {
        // Get all classification results for detailed analysis
        const classifications = classifier.getClassifications(message.content);
        const intent = classifications[0]?.label;
        const confidence = classifications[0]?.value || 0;
        const CONFIDENCE_THRESHOLD = 0.7;

        // Log classification results
        const classificationData = {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channelId,
            messageLength: message.content.length,
            intent: intent,
            confidence: Math.round(confidence * 1000) / 1000, // Round to 3 decimals
            confidenceThreshold: CONFIDENCE_THRESHOLD,
            meetsThreshold: confidence > CONFIDENCE_THRESHOLD,
            timestamp: new Date().toISOString()
        };

        context.log.info('Assistant message classification', classificationData);

        // Debug mode: log all classification scores
        if (isDebugMode) {
            const topClassifications = classifications.slice(0, 5).map(c => ({
                intent: c.label,
                confidence: Math.round(c.value * 1000) / 1000
            }));
            
            context.log.debug('Assistant detailed classification', {
                messageSnippet: message.content.slice(0, 100) + (message.content.length > 100 ? '...' : ''),
                topClassifications,
                totalCategories: classifications.length
            });
        }

        // Process if confidence threshold is met
        if (confidence > CONFIDENCE_THRESHOLD) {
            context.log.info('Assistant threshold met, processing intent', {
                intent,
                confidence,
                willProcess: intent === 'general-knowledge'
            });

            if (intent === 'general-knowledge') {
                context.log.info('Assistant generating response for general knowledge question', {
                    userId: message.author.id,
                    messageLength: message.content.length
                });

                const response = await generateResponse(message.content, context, {
                    userId: message.author.id,
                    username: message.author.username,
                    channelId: message.channelId
                });

                if (response && message.channel && 'send' in message.channel) {
                    try {
                        await message.channel.send(response);
                        
                        const processingTime = Date.now() - startTime;
                        context.log.info('Assistant response sent successfully', {
                            userId: message.author.id,
                            responseLength: response.length,
                            processingTimeMs: processingTime,
                            stage: 'response_sent',
                            success: true
                        });
                    } catch (sendError) {
                        context.log.error('Assistant failed to send response to Discord', {
                            userId: message.author.id,
                            error: sendError,
                            stage: 'discord_send',
                            success: false
                        });
                    }
                } else {
                    context.log.warn('Assistant generated no response or channel not available', {
                        userId: message.author.id,
                        hasResponse: !!response,
                        hasChannel: !!(message.channel && 'send' in message.channel),
                        stage: 'response_validation',
                        success: false
                    });
                }
            } else {
                context.log.info('Assistant classified message but not as general-knowledge', {
                    intent,
                    confidence,
                    stage: 'intent_filtered'
                });
            }
        } else {
            context.log.info('Assistant confidence below threshold, no response', {
                intent,
                confidence,
                confidenceThreshold: CONFIDENCE_THRESHOLD,
                stage: 'confidence_filtered'
            });
        }

    } catch (error) {
        const processingTime = Date.now() - startTime;
        context.log.error('Assistant processing error', {
            userId: message.author.id,
            error: error,
            processingTimeMs: processingTime,
            stage: 'classification_error',
            success: false
        });
    }
}