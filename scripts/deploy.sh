#!/bin/bash

# ChatPDF Deployment Script
# This script handles the deployment of the ChatPDF application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="chatpdf"
DEPLOYMENT_ENV=${1:-"production"}
BUILD_DIR=".next"
BACKUP_DIR="backups"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        error "git is not installed"
        exit 1
    fi
    
    success "All dependencies are installed"
}

# Validate environment variables
validate_env() {
    log "Validating environment variables..."
    
    required_vars=(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        "CLERK_SECRET_KEY"
        "DATABASE_URL"
        "AWS_ACCESS_KEY_ID"
        "AWS_SECRET_ACCESS_KEY"
        "AWS_REGION"
        "AWS_S3_BUCKET"
        "OPENAI_API_KEY"
        "PINECONE_API_KEY"
        "PINECONE_ENVIRONMENT"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    success "All environment variables are set"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    if npm test; then
        success "All tests passed"
    else
        error "Tests failed"
        exit 1
    fi
}

# Build the application
build_app() {
    log "Building application..."
    
    # Clean previous build
    if [ -d "$BUILD_DIR" ]; then
        log "Cleaning previous build..."
        rm -rf "$BUILD_DIR"
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --only=production
    
    # Build the application
    log "Building application..."
    if npm run build; then
        success "Application built successfully"
    else
        error "Build failed"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    if npm run db:push; then
        success "Database migrations completed"
    else
        error "Database migrations failed"
        exit 1
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for the application to start
    sleep 10
    
    # Check if the application is responding
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        success "Health check passed"
    else
        error "Health check failed"
        exit 1
    fi
}

# Backup current deployment
backup_current() {
    if [ -d "$BACKUP_DIR" ]; then
        log "Creating backup of current deployment..."
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_name="${APP_NAME}_backup_${timestamp}"
        
        if cp -r "$BUILD_DIR" "$BACKUP_DIR/$backup_name"; then
            success "Backup created: $backup_name"
        else
            warning "Failed to create backup"
        fi
    fi
}

# Deploy to different environments
deploy_production() {
    log "Deploying to production..."
    
    # Stop current application if running
    if pgrep -f "next start" > /dev/null; then
        log "Stopping current application..."
        pkill -f "next start"
    fi
    
    # Start the application
    log "Starting application..."
    nohup npm start > app.log 2>&1 &
    
    # Wait for startup
    sleep 5
    
    # Health check
    health_check
}

deploy_staging() {
    log "Deploying to staging..."
    
    # Similar to production but with different port
    export PORT=3001
    
    # Stop current application if running
    if pgrep -f "next start.*3001" > /dev/null; then
        log "Stopping current staging application..."
        pkill -f "next start.*3001"
    fi
    
    # Start the application
    log "Starting staging application..."
    nohup npm start > staging.log 2>&1 &
    
    # Wait for startup
    sleep 5
    
    # Health check on staging port
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        success "Staging health check passed"
    else
        error "Staging health check failed"
        exit 1
    fi
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current application
    if pgrep -f "next start" > /dev/null; then
        log "Stopping current application..."
        pkill -f "next start"
    fi
    
    # Find latest backup
    if [ -d "$BACKUP_DIR" ]; then
        latest_backup=$(ls -t "$BACKUP_DIR" | head -1)
        if [ -n "$latest_backup" ]; then
            log "Restoring from backup: $latest_backup"
            cp -r "$BACKUP_DIR/$latest_backup" "$BUILD_DIR"
            success "Rollback completed"
        else
            error "No backup found for rollback"
            exit 1
        fi
    else
        error "No backup directory found"
        exit 1
    fi
    
    # Restart application
    log "Restarting application..."
    nohup npm start > app.log 2>&1 &
    
    # Health check
    health_check
}

# Main deployment function
main() {
    log "Starting deployment for environment: $DEPLOYMENT_ENV"
    
    # Check dependencies
    check_dependencies
    
    # Validate environment variables
    validate_env
    
    # Run tests
    run_tests
    
    # Build application
    build_app
    
    # Run database migrations
    run_migrations
    
    # Backup current deployment
    backup_current
    
    # Deploy based on environment
    case $DEPLOYMENT_ENV in
        "production")
            deploy_production
            ;;
        "staging")
            deploy_staging
            ;;
        *)
            error "Unknown environment: $DEPLOYMENT_ENV"
            echo "Usage: $0 [production|staging]"
            exit 1
            ;;
    esac
    
    success "Deployment completed successfully!"
}

# Handle command line arguments
case "${1:-}" in
    "rollback")
        rollback
        ;;
    "health")
        health_check
        ;;
    "production"|"staging")
        main
        ;;
    *)
        echo "Usage: $0 [production|staging|rollback|health]"
        echo ""
        echo "Commands:"
        echo "  production  Deploy to production environment"
        echo "  staging     Deploy to staging environment"
        echo "  rollback    Rollback to previous deployment"
        echo "  health      Perform health check"
        exit 1
        ;;
esac