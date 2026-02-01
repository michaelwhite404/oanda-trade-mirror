#!/bin/bash
# ===========================================
# OANDA Trade Mirror - Deployment Script
# ===========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== OANDA Trade Mirror Deployment ===${NC}"

# Check for flyctl
if ! command -v fly &> /dev/null; then
    echo -e "${RED}Error: flyctl is not installed${NC}"
    echo "Install with: brew install flyctl"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Fly.io. Logging in...${NC}"
    fly auth login
fi

# Get app name from fly.toml
APP_NAME=$(grep '^app = ' fly.toml | sed 's/app = "\(.*\)"/\1/')
echo -e "Deploying app: ${GREEN}${APP_NAME}${NC}"

# Check if app exists
if ! fly status --app "$APP_NAME" &> /dev/null; then
    echo -e "${YELLOW}App doesn't exist. Creating...${NC}"
    fly apps create "$APP_NAME"

    echo -e "${YELLOW}Don't forget to set secrets:${NC}"
    echo "  fly secrets set JWT_SECRET=\$(openssl rand -base64 32)"
    echo "  fly secrets set MONGODB_URI=your-mongodb-uri"
    echo "  fly secrets set GOOGLE_CLIENT_ID=your-client-id"
    echo "  fly secrets set GOOGLE_CLIENT_SECRET=your-secret"
    echo "  fly secrets set GOOGLE_CALLBACK_URL=https://${APP_NAME}.fly.dev/api/auth/google/callback"
    echo "  fly secrets set VAPID_PUBLIC_KEY=your-public-key"
    echo "  fly secrets set VAPID_PRIVATE_KEY=your-private-key"
    echo "  fly secrets set VAPID_EMAIL=mailto:your@email.com"
    echo ""
    read -p "Press enter after setting secrets to continue deployment..."
fi

# Deploy
echo -e "${GREEN}Deploying to Fly.io...${NC}"
fly deploy

# Show status
echo -e "${GREEN}Deployment complete!${NC}"
fly status

echo ""
echo -e "App URL: ${GREEN}https://${APP_NAME}.fly.dev${NC}"
echo -e "View logs: ${YELLOW}fly logs${NC}"
echo -e "Open app: ${YELLOW}fly open${NC}"
