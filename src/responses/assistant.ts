import fs from 'fs';
import path from 'path';
import natural from 'natural';
import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';

const classifier = new natural.BayesClassifier();

const classifiersFilePath = path.join(__dirname, '../data/classifiers.json');
const classifiersData = fs.readFileSync(classifiersFilePath, 'utf-8');
const classifiers = JSON.parse(classifiersData);

classifiers.forEach((classifierData: { text: string, category: string }) => {
    classifier.addDocument(classifierData.text, classifierData.category);
});

classifier.train();

export default async (message: Message, context: Context) => {
    if (message.author.bot) {return;}

    const intent = classifier.classify(message.content);
    const confidence = classifier.getClassifications(message.content)[0].value;

    const CONFIDENCE_THRESHOLD = 0.7;

    if (confidence > CONFIDENCE_THRESHOLD) {
        if (intent === 'general-knowledge') {
            const response = await generateResponse(message.content, context);
            if (response && message.channel && 'send' in message.channel) {
                message.channel.send(response);
            }
        }
    }
}