# Taskforce Connector Fork Implementation Plan

> **Package Manager:** Always use **NPM** in this repository. Do not use yarn or pnpm.

## Problem

AWS MemoryDB (Redis Cluster with TLS) fails with `Failed to refresh slots cache` because:

1. **ioredis resolves hostnames to IPs** before connecting
2. **TLS certificates are issued for hostnames**, not IPs
3. **Certificate validation fails** → connection closed → slots cache refresh fails

## Solution

Add `dnsLookup` bypass to ioredis cluster configuration, matching our working `workflow-orchestration` pattern.

**Assume you're already working in the fork repository.**

There are already changes in the .github folder - we've removed upstream workflows we're not going to use.

---

## Phase 1: Apply MemoryDB Compatibility Fix

**Status: Implementation complete, pending verification**

### 1.1 Modify `lib/queue-factory.ts` ✅

Find the `getRedisClient()` function that creates the ioredis Cluster instance.

**Add this to the Cluster options:**

```typescript
dnsLookup: (address: string, callback: (err: Error | null, address: string) => void) =>
  callback(null, address),
```

**Also fix TLS options** - change from:

```typescript
tls: {
  rejectUnauthorized: false,
  requestCert: true,
  agent: false,
}
```

To:

```typescript
tls: {
} // Use system defaults with proper cert validation
```

### 1.2 Modify `lib/cmd.ts` ✅

TLS options updated to use system defaults (empty object instead of `rejectUnauthorized: false`).

### 1.3 Commit and push

```bash
git add -A
git commit -m "Add dnsLookup bypass for AWS MemoryDB TLS compatibility"
git push -u origin fix-awsmemorydb-compat
```

---

## Phase 2: Build Container from Source

The existing Dockerfile uses the `taskforce` NPM package. Since this is a fork, we need to build and run directly from the repository source.

### 2.1 Create branch

```bash
git checkout fix-awsmemorydb-compat
git checkout -b build-container-from-source
```

### 2.2 Modify Dockerfile

Replace the existing Dockerfile to build from source instead of using the NPM package:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pm2 globally for process management
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Run with pm2-runtime for resilience (auto-restart on crash)
CMD ["pm2-runtime", "dist/index.js"]

HEALTHCHECK --interval=30s --timeout=30s \
  --start-period=5s --retries=3 CMD curl -f http://localhost || exit 1
```

> **Note:** Adjust the build command and entry point based on the actual project structure (check `package.json` for the correct build script and main entry).

### 2.3 Commit and push

```bash
git add -A
git commit -m "Build and run container from source instead of NPM package"
git push -u origin build-container-from-source
```

---

## Phase 3: Container Image Workflow

### 3.1 Continue in Phase 2 branch

```bash
git checkout build-container-from-source
```

### 3.2 Add GitHub Actions workflow

Create `.github/workflows/docker-publish.yml`:

```yaml
name: Build and Publish Docker Image

on:
  push:
    branches:
      - master

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Run tests
        run: npm test

  build-and-push:
    needs: build-and-test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### 3.3 Commit and push

```bash
git add -A
git commit -m "Add GitHub Actions workflow for container image publishing"
git push origin build-container-from-source
```

### 3.4 Merge branches to master

1. Create PR: `fix-awsmemorydb-compat` → `master`, review and merge
2. Create PR: `build-container-from-source` → `master`, review and merge
3. Workflow triggers on push to `master`, builds and publishes image

### 3.5 Make package public (if needed)

1. Go to `https://github.com/orgs/serenityapp/packages`
2. Find `taskforce-connector` package
3. Package Settings → Change visibility → Public

---

## Result

Public container image available at:

```
ghcr.io/serenityapp/taskforce-connector:latest
ghcr.io/serenityapp/taskforce-connector:<commit-sha>
```

Reference this image in ECS task definitions, Kubernetes deployments, etc.

---

## Reference Implementation

From `packages/service-workflow-orchestration/src/shared/redis-connection.ts`:

```typescript
new Cluster([{ host, port }], {
  dnsLookup: (address: string, callback: (err: Error | null, address: string) => void) =>
    callback(null, address),
  redisOptions: {
    tls: {}, // Empty = TLS with system defaults
    keepAlive: 30000,
    maxRetriesPerRequest: null,
  },
  enableOfflineQueue: false,
  retryDelayOnFailover: 100,
});
```

---

## Environment Variables

The fork should respect existing env vars:

- `REDIS_NODES` - cluster endpoint(s)
- `REDIS_USE_TLS` or `REDIS_CLUSTER_TLS` - enable TLS
