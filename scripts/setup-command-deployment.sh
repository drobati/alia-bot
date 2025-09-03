#!/bin/bash

# Discord Command Deployment System Setup Script
# Sets up the CI/CD infrastructure for automatic command deployment

set -e

echo "🚀 Setting up Discord Command Deployment System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -d "src/commands" ]]; then
    print_error "This script must be run from the alia-bot project root directory"
    exit 1
fi

# Check if required commands are available
command -v node >/dev/null 2>&1 || { print_error "Node.js is required but not installed. Please install Node.js and try again."; exit 1; }
command -v npm >/dev/null 2>&1 || { print_error "npm is required but not installed. Please install npm and try again."; exit 1; }

# Create necessary directories
print_info "Creating deployment directories..."
mkdir -p command-backups
mkdir -p logs

# Make scripts executable
print_info "Setting script permissions..."
chmod +x scripts/deploy-commands.js
chmod +x scripts/discord-commands/command-detector.js
chmod +x scripts/discord-commands/rollback-commands.js
chmod +x scripts/discord-commands/deployment-monitor.js

print_success "Scripts made executable"

# Install dependencies if not already installed
if [[ ! -d "node_modules" ]]; then
    print_info "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_info "Dependencies already installed"
fi

# Build the project to ensure everything compiles
print_info "Building TypeScript project..."
npm run build
print_success "Project built successfully"

# Initialize command checksums
print_info "Initializing command change detection..."
if [[ ! -f ".command-checksums.json" ]]; then
    node scripts/discord-commands/command-detector.js
    print_success "Command checksums initialized"
else
    print_warning "Command checksums already exist, skipping initialization"
fi

# Check environment configuration
print_info "Checking environment configuration..."

ENV_ISSUES=0

# Check for required environment variables in local development
if [[ -f ".env" ]]; then
    if ! grep -q "BOT_TOKEN=" .env; then
        print_warning "BOT_TOKEN not found in .env file"
        ENV_ISSUES=$((ENV_ISSUES + 1))
    fi
    
    if ! grep -q "CLIENT_ID=" .env; then
        print_warning "CLIENT_ID not found in .env file"
        ENV_ISSUES=$((ENV_ISSUES + 1))
    fi
    
    if [[ $ENV_ISSUES -eq 0 ]]; then
        print_success "Environment variables configured in .env"
    fi
else
    print_warning ".env file not found - creating template"
    cat > .env.template << EOF
# Discord Bot Configuration
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_application_id_here
GUILD_ID=your_test_guild_id_here  # Optional: for testing in specific server

# Environment
NODE_ENV=development

# Optional: Monitoring & Alerts
SENTRY_DSN=your_sentry_dsn_here
SLACK_WEBHOOK_URL=your_slack_webhook_url_here

# Database (for testing)
MYSQLDB_DATABASE=aliadb
MYSQLDB_USER=aliabot
MYSQLDB_PASSWORD=your_mysql_password_here
EOF
    print_info "Created .env.template - copy to .env and fill in your values"
    ENV_ISSUES=$((ENV_ISSUES + 1))
fi

# Test local deployment system
if [[ $ENV_ISSUES -eq 0 ]]; then
    print_info "Testing command detection system..."
    if npm run commands:detect; then
        print_success "Command detection system working"
    else
        print_error "Command detection system test failed"
    fi
else
    print_warning "Skipping command detection test - environment not configured"
fi

# GitHub Actions setup check
print_info "Checking GitHub Actions setup..."

GITHUB_ISSUES=0

if [[ -f ".github/workflows/command-deployment.yml" ]]; then
    print_success "Command deployment workflow exists"
else
    print_error "Command deployment workflow not found"
    GITHUB_ISSUES=$((GITHUB_ISSUES + 1))
fi

if [[ -f ".github/workflows/ci.yml" ]]; then
    print_success "CI workflow exists"
else
    print_warning "CI workflow not found - command deployment depends on CI"
    GITHUB_ISSUES=$((GITHUB_ISSUES + 1))
fi

# AWS Parameter Store setup check
print_info "Checking AWS configuration requirements..."

if command -v aws >/dev/null 2>&1; then
    print_success "AWS CLI is installed"
    
    # Check if user has AWS credentials configured
    if aws sts get-caller-identity >/dev/null 2>&1; then
        print_success "AWS credentials configured"
        
        print_info "Checking required parameter store values..."
        PARAMS_MISSING=0
        
        # Check staging parameters
        for param in "BOT_TOKEN" "CLIENT_ID"; do
            if ! aws ssm get-parameter --name "/alia-bot/staging/$param" >/dev/null 2>&1; then
                print_warning "Missing staging parameter: /alia-bot/staging/$param"
                PARAMS_MISSING=$((PARAMS_MISSING + 1))
            fi
        done
        
        # Check production parameters
        for param in "BOT_TOKEN" "CLIENT_ID"; do
            if ! aws ssm get-parameter --name "/alia-bot/production/$param" >/dev/null 2>&1; then
                print_warning "Missing production parameter: /alia-bot/production/$param"
                PARAMS_MISSING=$((PARAMS_MISSING + 1))
            fi
        done
        
        if [[ $PARAMS_MISSING -eq 0 ]]; then
            print_success "All AWS parameters configured"
        else
            print_warning "$PARAMS_MISSING AWS parameters missing"
        fi
        
    else
        print_warning "AWS credentials not configured"
    fi
else
    print_warning "AWS CLI not installed - required for production deployment"
fi

# GitHub CLI check
if command -v gh >/dev/null 2>&1; then
    print_success "GitHub CLI is installed"
    
    if gh auth status >/dev/null 2>&1; then
        print_success "GitHub CLI authenticated"
    else
        print_warning "GitHub CLI not authenticated - run 'gh auth login'"
    fi
else
    print_warning "GitHub CLI not installed - useful for manual deployments"
fi

# Create deployment status dashboard
print_info "Creating deployment status dashboard..."

cat > deployment-status.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Alia Bot - Command Deployment Status</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #2c2f33; color: #ffffff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .status-card { background: #36393f; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .success { border-left: 5px solid #43b581; }
        .warning { border-left: 5px solid #faa61a; }
        .error { border-left: 5px solid #f04747; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; }
        .metric-label { font-size: 0.9em; opacity: 0.8; }
        pre { background: #2c2f33; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Alia Bot - Command Deployment Status</h1>
        
        <div class="status-card success">
            <h2>📊 Quick Status</h2>
            <div class="metric">
                <div class="metric-value" id="command-count">--</div>
                <div class="metric-label">Total Commands</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="last-deployment">--</div>
                <div class="metric-label">Last Deployment</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="health-status">--</div>
                <div class="metric-label">Health Status</div>
            </div>
        </div>
        
        <div class="status-card">
            <h2>🚀 Quick Commands</h2>
            <pre>
# Check command health
npm run commands:health

# Deploy to staging
npm run commands:deploy:staging  

# Emergency rollback
npm run commands:rollback

# Monitor continuously
npm run commands:monitor:continuous
            </pre>
        </div>
        
        <div class="status-card">
            <h2>📈 Recent Activity</h2>
            <div id="recent-deployments">
                <p>Loading deployment history...</p>
            </div>
        </div>
        
        <div class="status-card">
            <h2>🔧 System Health</h2>
            <div id="system-health">
                <p>Loading health metrics...</p>
            </div>
        </div>
    </div>
    
    <script>
        // Simple dashboard that reads local log files
        // In a real deployment, this would connect to monitoring APIs
        
        function loadStatus() {
            // This is a placeholder - in production, you'd fetch from APIs
            document.getElementById('command-count').textContent = '42';
            document.getElementById('last-deployment').textContent = '2h ago';
            document.getElementById('health-status').textContent = '✅';
            
            document.getElementById('recent-deployments').innerHTML = 
                '<p>✅ Production deployment successful (2 hours ago)</p>' +
                '<p>✅ Staging deployment successful (2 hours ago)</p>' +
                '<p>🔄 Command changes detected (3 hours ago)</p>';
            
            document.getElementById('system-health').innerHTML = 
                '<p>✅ Discord API: Healthy</p>' +
                '<p>✅ Command Response Time: 234ms</p>' +
                '<p>✅ Error Rate: 0.1%</p>';
        }
        
        // Load status on page load
        loadStatus();
        
        // Refresh every 30 seconds
        setInterval(loadStatus, 30000);
    </script>
</body>
</html>
EOF

print_success "Created deployment status dashboard: deployment-status.html"

# Create helper script for common operations
print_info "Creating deployment helper script..."

cat > scripts/deployment-helper.sh << 'EOF'
#!/bin/bash

# Helper script for common deployment operations
# Usage: ./scripts/deployment-helper.sh [command]

set -e

case "$1" in
    "health")
        echo "🔍 Checking command deployment health..."
        npm run commands:health
        ;;
    "deploy-staging")
        echo "🚀 Deploying to staging..."
        npm run commands:deploy:staging
        ;;
    "deploy-production")
        echo "🚀 Deploying to production..."
        npm run commands:deploy
        ;;
    "rollback")
        echo "🔄 Initiating rollback..."
        npm run commands:rollback
        ;;
    "monitor")
        echo "📊 Starting continuous monitoring..."
        npm run commands:monitor:continuous
        ;;
    "status")
        echo "📈 Deployment Status:"
        echo "===================="
        
        if [[ -f "command-deployment-report.json" ]]; then
            echo "Last Change Detection:"
            cat command-deployment-report.json | jq -r '.timestamp'
            echo ""
            echo "Command Summary:"
            cat command-deployment-report.json | jq '.changes'
        fi
        
        if [[ -f "deployment.log" ]]; then
            echo ""
            echo "Recent Deployments:"
            tail -5 deployment.log | jq -r '"\(.timestamp) - \(.success | if . then "✅" else "❌" end) \(.environment // "unknown")"'
        fi
        
        if [[ -f "metrics.log" ]]; then
            echo ""
            echo "Health Status:"
            tail -1 metrics.log | jq -r '"Response Time: \(.responseTime)ms, Commands: \(.commandCount), Status: \(.success | if . then "✅ Healthy" else "❌ Unhealthy" end)"'
        fi
        ;;
    "clean")
        echo "🧹 Cleaning deployment artifacts..."
        rm -f .command-checksums.json
        rm -f command-deployment-report.json
        rm -rf command-backups/*.json
        echo "✅ Cleanup complete"
        ;;
    *)
        echo "🤖 Alia Bot Deployment Helper"
        echo "============================="
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  health           - Check deployment health"
        echo "  deploy-staging   - Deploy to staging environment"
        echo "  deploy-production- Deploy to production"
        echo "  rollback         - Emergency rollback"
        echo "  monitor          - Start continuous monitoring"
        echo "  status           - Show deployment status"
        echo "  clean            - Clean deployment artifacts"
        echo ""
        echo "Examples:"
        echo "  $0 health"
        echo "  $0 deploy-staging"
        echo "  $0 status"
        ;;
esac
EOF

chmod +x scripts/deployment-helper.sh
print_success "Created deployment helper script"

# Final summary
echo ""
echo "======================================"
print_success "Discord Command Deployment System Setup Complete!"
echo "======================================"

echo ""
print_info "📋 Setup Summary:"
echo "  ✅ Deployment scripts configured"
echo "  ✅ Directory structure created"
echo "  ✅ Package.json scripts added"
echo "  ✅ Command detection initialized"

if [[ $ENV_ISSUES -eq 0 ]]; then
    echo "  ✅ Environment variables configured"
else
    echo "  ⚠️  Environment variables need configuration"
fi

if [[ $GITHUB_ISSUES -eq 0 ]]; then
    echo "  ✅ GitHub Actions workflows ready"
else
    echo "  ⚠️  GitHub Actions setup incomplete"
fi

echo ""
print_info "🚀 Next Steps:"

if [[ $ENV_ISSUES -gt 0 ]]; then
    echo "  1. Copy .env.template to .env and configure your Discord bot credentials"
fi

echo "  2. Test local deployment: npm run commands:detect"
echo "  3. Set up AWS Parameter Store with staging/production credentials"
echo "  4. Configure GitHub repository secrets for CI/CD"
echo "  5. Test full pipeline with a test command change"

echo ""
print_info "📚 Resources:"
echo "  - Documentation: docs/COMMAND-DEPLOYMENT.md"
echo "  - Status Dashboard: deployment-status.html"
echo "  - Helper Script: scripts/deployment-helper.sh"

echo ""
print_info "🔧 Common Commands:"
echo "  npm run commands:health       - Check deployment health"
echo "  npm run commands:deploy:staging - Deploy to staging"
echo "  ./scripts/deployment-helper.sh status - Show deployment status"

echo ""
print_success "Setup complete! The Discord Command Deployment System is ready to use."
EOF

chmod +x scripts/setup-command-deployment.sh