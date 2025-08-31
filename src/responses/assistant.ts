import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';
import { HybridClassifier } from '../utils/hybrid-classifier';
import { safelySendToChannel } from '../utils/discordHelpers';

// Initialize hybrid classifier (combines keyword patterns + Bayesian ML)
const hybridClassifier = new HybridClassifier();

// Static constants to avoid array recreation on every function call
const RESPONSE_INTENTS = ['general-knowledge', 'real-time-knowledge', 'technical-question'];

// Content appropriateness check - filters out inappropriate, personal, or social requests
function checkContentAppropriateness(content: string): boolean {
    const lowerContent = content.toLowerCase().trim();

    // Skip if too short or unclear
    if (lowerContent.length < 3) {
        return false;
    }

    // Inappropriate content patterns
    const inappropriatePatterns = [
        /you.*stupid/,
        /you.*suck/,
        /shut.*up/,
        /fuck/,
        /shit/,
        /damn.*you/,
        /hate.*you/,
    ];

    // Personal/social request patterns (not general knowledge)
    const personalPatterns = [
        /tell\s+\w+\s+(he|she|they)/,  // "tell John he..."
        /my\s+hand\s+hurts/,
        /my\s+.*\s+(hurts|aches|pains)/,
        /i\s+(think|feel|believe)\s+that/,
        /you\s+(should|need\s+to|have\s+to)/,
        /can\s+you\s+(tell|ask|remind)/,
    ];

    // Check for inappropriate content
    for (const pattern of inappropriatePatterns) {
        if (pattern.test(lowerContent)) {
            return false;
        }
    }

    // Check for personal/social requests
    for (const pattern of personalPatterns) {
        if (pattern.test(lowerContent)) {
            return false;
        }
    }

    return true;
}

// Hybrid Assistant classifier initialized with keyword patterns + Bayesian ML

export default async (message: Message, context: Context) => {
    if (message.author.bot) {
        return;
    }

    // Layer 1: Direct Addressing Pre-filter
    // Only process messages that explicitly address the bot
    const content = message.content.toLowerCase().trim();
    const botMentioned = message.mentions.has(message.client.user!);
    const startsWithAlia = content.startsWith('alia,') || content.startsWith('alia ');

    if (!botMentioned && !startsWithAlia) {
        // Log that we skipped processing due to no direct addressing
        context.log.debug('Assistant skipped - not directly addressed', {
            userId: message.author.id,
            messageLength: message.content.length,
            botMentioned,
            startsWithAlia,
            stage: 'direct_addressing_filter',
        });
        return;
    }

    // Remove the "Alia," prefix for processing
    let processableContent = message.content;
    if (startsWithAlia) {
        processableContent = message.content.replace(/^alia,?\s*/i, '').trim();
    }

    // If after removing prefix, there's no meaningful content, skip
    if (!processableContent || processableContent.length < 3) {
        context.log.debug('Assistant skipped - no meaningful content after prefix removal', {
            userId: message.author.id,
            originalLength: message.content.length,
            processableLength: processableContent.length,
            stage: 'content_validation_filter',
        });
        return;
    }

    const startTime = Date.now();
    context.log.info('Assistant processing directly addressed message', {
        userId: message.author.id,
        botMentioned,
        startsWithAlia,
        originalLength: message.content.length,
        processableLength: processableContent.length,
        stage: 'direct_addressing_passed',
    });
    const isDebugMode = process.env.ASSISTANT_DEBUG === 'true';

    try {
        // Layer 2: Use hybrid classifier on cleaned content for better accuracy
        const classificationResult = hybridClassifier.classify(processableContent);
        const intent = classificationResult.intent;
        const confidence = classificationResult.confidence;
        const method = classificationResult.method;
        // Layer 2: Improved thresholds - since we have direct addressing, we can be more selective
        const CONFIDENCE_THRESHOLD = 0.7; // Higher threshold since direct addressing filters intent

        // Log classification results
        const classificationData = {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channelId,
            messageLength: message.content.length,
            intent: intent,
            confidence: Math.round(confidence * 1000) / 1000, // Round to 3 decimals
            method: method, // 'keyword', 'bayesian', or 'fallback'
            confidenceThreshold: CONFIDENCE_THRESHOLD,
            meetsThreshold: confidence > CONFIDENCE_THRESHOLD,
            timestamp: new Date().toISOString(),
        };

        context.log.info('Assistant message classification', classificationData);

        // Debug mode: log detailed classification analysis
        if (isDebugMode) {
            const detailedClassification = hybridClassifier.getDetailedClassification(processableContent);
            context.log.debug('Assistant detailed classification', detailedClassification);
        }

        // Layer 2: Content appropriateness check
        const isAppropriateContent = checkContentAppropriateness(processableContent);

        if (!isAppropriateContent) {
            context.log.info('Assistant skipped - inappropriate content detected', {
                userId: message.author.id,
                intent,
                confidence,
                stage: 'content_appropriateness_filter',
            });
            return;
        }

        // Process if confidence threshold is met
        if (confidence > CONFIDENCE_THRESHOLD) {
            // Use static responseIntents constant to avoid array recreation
            const willProcess = RESPONSE_INTENTS.includes(intent);
            context.log.info('Assistant threshold met, processing intent', {
                intent,
                confidence,
                willProcess,
            });

            if (willProcess) {
                context.log.info('Assistant generating response for knowledge question', {
                    userId: message.author.id,
                    messageLength: message.content.length,
                });

                const response = await generateResponse(processableContent, context, {
                    userId: message.author.id,
                    username: message.author.username,
                    channelId: message.channelId,
                });

                if (response && message.channel && 'send' in message.channel) {
                    const success = await safelySendToChannel(
                        message.channel as any,
                        response,
                        context,
                        'assistant response',
                    );

                    const processingTime = Date.now() - startTime;
                    if (success) {
                        context.log.info('Assistant response sent successfully', {
                            userId: message.author.id,
                            responseLength: response.length,
                            processingTimeMs: processingTime,
                            stage: 'response_sent',
                            success: true,
                        });
                    } else {
                        context.log.error('Assistant failed to send response to Discord', {
                            userId: message.author.id,
                            responseLength: response.length,
                            processingTimeMs: processingTime,
                            stage: 'discord_send',
                            success: false,
                        });
                    }
                } else {
                    context.log.warn('Assistant generated no response or channel not available', {
                        userId: message.author.id,
                        hasResponse: !!response,
                        hasChannel: !!(message.channel && 'send' in message.channel),
                        stage: 'response_validation',
                        success: false,
                    });
                }
            } else {
                context.log.info('Assistant classified message but not as general-knowledge', {
                    intent,
                    confidence,
                    stage: 'intent_filtered',
                });
            }
        } else {
            context.log.info('Assistant confidence below threshold, no response', {
                intent,
                confidence,
                confidenceThreshold: CONFIDENCE_THRESHOLD,
                stage: 'confidence_filtered',
            });
        }

    } catch (error) {
        const processingTime = Date.now() - startTime;
        context.log.error('Assistant processing error', {
            userId: message.author.id,
            error: error,
            processingTimeMs: processingTime,
            stage: 'classification_error',
            success: false,
        });
    }
}