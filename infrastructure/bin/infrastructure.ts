#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AliaBotStack } from '../lib/alia-bot-stack';

const app = new cdk.App();

// Get environment from context or default to 'prod'
const environment = app.node.tryGetContext('environment') || 'prod';

// AWS Account and Region configuration
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT || '319709948884',
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Production Stack
new AliaBotStack(app, `AliaBotStack-${environment}`, {
    env,
    environment,
    containerMemory: 512,
    desiredCount: 1,
    description: `Alia Bot infrastructure for ${environment} environment`,
    tags: {
        Project: 'alia-bot',
        Environment: environment,
        ManagedBy: 'CDK',
    },
});

app.synth();
