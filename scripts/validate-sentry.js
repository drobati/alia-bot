#!/usr/bin/env node

/**
 * Standalone Sentry validation script
 * Usage: node scripts/validate-sentry.js
 * 
 * This script validates the Sentry DSN without starting the full bot,
 * useful for debugging production environment issues.
 */

require('dotenv').config();
const { initializeSentry, testSentryConnectivity } = require('../dist/src/lib/sentry');

async function validateSentry() {
    console.log('🔍 Validating Sentry Configuration...\n');
    
    // Check if SENTRY_DSN is set
    const sentryDsn = process.env.SENTRY_DSN;
    if (!sentryDsn) {
        console.error('❌ SENTRY_DSN environment variable not set');
        console.log('\nExpected format: https://PUBLIC_KEY@ORGANIZATION_ID.ingest.sentry.io/PROJECT_ID');
        process.exit(1);
    }

    console.log(`✅ SENTRY_DSN is set: ${sentryDsn.substring(0, 30)}...`);

    // Initialize Sentry (this will run our validation)
    try {
        console.log('\n📡 Initializing Sentry...');
        initializeSentry();
        
        // Wait for the async connectivity test to complete
        console.log('\n⏳ Waiting for connectivity test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Manual connectivity test
        console.log('\n🔌 Running additional connectivity test...');
        const result = await testSentryConnectivity();
        
        if (result.success) {
            console.log('✅ Additional connectivity test PASSED');
            console.log('\n🎉 Sentry configuration is working correctly!');
            console.log('\n📝 Next steps:');
            console.log('1. Check Sentry dashboard for test events');
            console.log('2. If events appear, the issue might be in production environment');
            console.log('3. If no events, verify Sentry project settings');
        } else {
            console.error(`❌ Additional connectivity test FAILED: ${result.error}`);
            console.log('\n🚨 Possible issues:');
            console.log('1. Invalid DSN format or credentials');
            console.log('2. Network connectivity issues');
            console.log('3. Sentry project not accessible');
            console.log('4. Rate limiting or quota exceeded');
        }

    } catch (error) {
        console.error(`❌ Sentry initialization failed: ${error.message}`);
        process.exit(1);
    }

    // Force exit after a delay to ensure all async operations complete
    setTimeout(() => {
        console.log('\n✨ Validation complete');
        process.exit(0);
    }, 1000);
}

validateSentry().catch(error => {
    console.error(`💥 Validation script failed: ${error.message}`);
    process.exit(1);
});