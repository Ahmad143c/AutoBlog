#!/bin/bash
set -e

# Install pnpm
npm install -g pnpm@8

# Install dependencies
pnpm install --frozen-lockfile

# Build shared package first
cd ../../packages/shared && pnpm build && cd ../../apps/api

# Build the application
pnpm build

# Generate Prisma client
npx prisma generate