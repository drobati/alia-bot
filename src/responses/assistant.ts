import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';
import { HybridClassifier } from '../utils/hybrid-classifier';

// Initialize hybrid classifier (combines keyword patterns + Bayesian ML)
const hybridClassifier = new HybridClassifier();

// Hybrid Assistant classifier initialized with keyword patterns + Bayesian ML

export default async (message: Message, context: Context) => {
    if (message.author.bot) {
        return;
    }

    const startTime = Date.now();
    const isDebugMode = process.env.ASSISTANT_DEBUG === 'true';

    try {
        // Use hybrid classifier for better accuracy
        const classificationResult = hybridClassifier.classify(message.content);
        const intent = classificationResult.intent;
        const confidence = classificationResult.confidence;
        const method = classificationResult.method;
        const CONFIDENCE_THRESHOLD = 0.5; // Raised back up since hybrid classifier should have better confidence

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
            const detailedClassification = hybridClassifier.getDetailedClassification(message.content);
            context.log.debug('Assistant detailed classification', detailedClassification);
        }

        // Process if confidence threshold is met
        if (confidence > CONFIDENCE_THRESHOLD) {
            context.log.info('Assistant threshold met, processing intent', {
                intent,
                confidence,
                willProcess: intent === 'general-knowledge',
            });

            if (intent === 'general-knowledge') {
                context.log.info('Assistant generating response for general knowledge question', {
                    userId: message.author.id,
                    messageLength: message.content.length,
                });

                const response = await generateResponse(message.content, context, {
                    userId: message.author.id,
                    username: message.author.username,
                    channelId: message.channelId,
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
                            success: true,
                        });
                    } catch (sendError) {
                        context.log.error('Assistant failed to send response to Discord', {
                            userId: message.author.id,
                            error: sendError,
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