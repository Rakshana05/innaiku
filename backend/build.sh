#!/usr/bin/env bash
# exit on error
set -o errexit

echo "=== 1. Building React Mobile Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== 2. Installing Python Dependencies ==="
pip install -r requirements.txt

echo "=== Build Completed Successfully! ==="
