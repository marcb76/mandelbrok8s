#!/usr/bin/env bash
# ==============================================================================
# Script Name: build.sh
# Description: Automates Docker image builds, tagging, and pushing to Docker Hub
# Author: Marc Bonet Bretto
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Define your Docker Hub username or namespace here
DOCKER_HUB_USER="marcb76"




# Intro banner
clear
echo ""
echo ""
echo "===================================================="
echo " Mandelbrok8s Docker Images Builder"
echo ""
echo " Copyright © 2026 Marc Bonet Bretto"
echo " All rights reserved."
echo "===================================================="
echo ""
echo ""
echo ""
echo ""


# Login to Docker Hub securely
echo "[LOGIN       ] Logging in to Docker Hub..."
# Two options: environment variable or interactive input
# Option A: If you DOCKER_HUB_PASSWORD environment variable is defined, use it!
if [ -n "$DOCKER_HUB_PASSWORD" ]; then
    echo "${DOCKER_HUB_PASSWORD}" | docker login -u "${DOCKER_HUB_USER}" --password-stdin
else
    # Option B: No environment variable is defined, Docker will prompt for the password interactively and securely in the terminal
    docker login -u "${DOCKER_HUB_USER}"
fi
echo ""
echo ""


# Ensure a buildx builder instance is ready
echo "[BUILDX      ] Ensuring buildx builder instance is ready..."
docker buildx use default || docker buildx create --use
echo ""
echo ""


# Build and tag Orchestrator
echo "[BUILD & PUSH] Building & pushing Orchestrator for AMD64 & ARM64..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t ${DOCKER_HUB_USER}/mandelbrok8s-orchestrator:latest \
    -f Dockerfile.orchestrator \
    --push \
    ..
echo ""
echo ""


# Build and tag Worker
echo "[BUILD & PUSH] Building & pushing Worker for AMD64 & ARM64..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t ${DOCKER_HUB_USER}/mandelbrok8s-worker:latest \
    -f Dockerfile.worker \
    --push \
    ..
echo ""
echo ""
echo ""
echo ""




# Outro banner
echo "===================================================="
echo " All multi-arch Docker images successfully built and pushed to Docker Hub!"
echo " Have a nice day!"
echo "===================================================="
echo ""
echo ""
echo ""
echo ""
echo ""
echo ""
