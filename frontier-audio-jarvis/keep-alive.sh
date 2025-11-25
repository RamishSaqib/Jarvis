#!/bin/bash

# Keep-Alive Script for Render Free Tier Services
# This script pings your services to prevent them from sleeping

# Replace these with your actual Render service URLs
AI_SERVICE_URL="https://your-ai-service.onrender.com"
BACKEND_URL="https://your-backend.onrender.com/health"

echo "Pinging AI Service..."
curl -s "$AI_SERVICE_URL" > /dev/null
echo "✓ AI Service pinged"

echo "Pinging Backend..."
curl -s "$BACKEND_URL" > /dev/null
echo "✓ Backend pinged"

echo "Keep-alive complete at $(date)"
