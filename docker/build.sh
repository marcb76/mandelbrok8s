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
DOCKER_HUB_USER_PASSWORD="KrgaTYsz3YK5Sd)"




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


# Build and tag Orchestrator
echo "[BUILD] Building Orchestrator image (mandelbrok8s-orchestrator:latest)..."
docker build -t ${DOCKER_HUB_USER}/mandelbrok8s-orchestrator:latest -f Dockerfile.orchestrator ..
echo ""


# Build and tag Worker
echo "[BUILD] Building Worker image (mandelbrok8s-worker:latest)..."
docker build -t ${DOCKER_HUB_USER}/mandelbrok8s-worker:latest -f Dockerfile.worker ..
echo ""
echo ""
echo ""
echo ""


# Login to Docker Hub securely
echo "[LOGIN] Logging in to Docker Hub..."
# Two options: environment variable or interactive input
# Option A: If you DOCKER_PASSWORD environment variable is defined, use it!
if [ -n "$DOCKER_PASSWORD" ]; then
    echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_HUB_USER}" --password-stdin
else
    # Option B: No environment variable is defined, Docker will prompt for the password interactively and securely in the terminal
    docker login -u "${DOCKER_HUB_USER}"
fi
echo ""


# Push Orchestrator
echo "[PUSH ] Pushing Orchestrator image to Docker Hub..."
docker push ${DOCKER_HUB_USER}/mandelbrok8s-orchestrator:latest
echo ""

# Push Worker
echo "[PUSH ] Pushing Worker image to Docker Hub..."
docker push ${DOCKER_HUB_USER}/mandelbrok8s-worker:latest
echo ""
echo ""
echo ""
echo ""




# Outro banner
echo "===================================================="
echo " All Docker images successfully built and pushed to Docker Hub!"
echo " Finished all Docker image operations."
echo " Have a nice day!"
echo "===================================================="
echo ""
echo ""
echo ""
echo ""
echo ""
echo ""
