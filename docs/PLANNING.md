# CDE AI - Development Roadmap

## Current State
- ✅ ZIP upload works
- ✅ GitHub URL clone exists but limited by rate limits (60 req/hour for unauthenticated)
- ✅ MCP server running on port 3002

## Phase 1: Fix GitHub Integration (Priority: HIGH)

### Problem
GitHub's unauthenticated API has strict rate limits (60 requests/hour), causing clone failures.

### Solutions
1. **Add GitHub Token Support** - Use personal access token for higher rate limits (5000 req/hour)
2. **Implement Caching** - Cache recently analyzed repos to reduce API calls
3. **Add GitHub App Integration** - For private repo support with OAuth

### Tasks
- [ ] Add optional `GITHUB_TOKEN` to .env
- [ ] Implement repo content caching (Redis or in-memory)
- [ ] Add rate limit detection and automatic retry

---

## Phase 2: Package Manager Migration (Priority: MEDIUM)

### Tasks
- [ ] Replace npm with pnpm in package.json scripts
- [ ] Update README with pnpm installation instructions
- [ ] Add .npmrc / pnpm-workspace.yaml if needed

---

## Phase 3: Enhanced Graph Features (Priority: MEDIUM)

### Tasks
- [ ] Add support for more languages (Go, Rust, Java)
- [ ] Implement graph persistence (save/load)
- [ ] Add multi-repo comparison

---

## Phase 4: Deployment (Priority: LOW)

### Tasks
- [ ] Set up Railway deployment
- [ ] Configure environment variables
- [ ] Add CI/CD pipeline

---

## Technical Notes

### GitHub API Endpoints Used
- `GET /repos/{owner}/{repo}/zipball/{ref}` - Download repo as ZIP

### Server Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload ZIP file |
| `/api/clone` | POST | Clone GitHub repo |
| `/api/query` | POST | AI query |
| `/api/processes` | POST | Detect processes |
| `/api/report` | POST | Generate report |
| `/api/node-summary` | POST | Node AI summary |
| `/api/file` | GET | Get cached file |
| `/health` | GET | Health check |

### Rate Limit Strategy
```typescript
// Pseudo-code for rate limit handling
const RATE_LIMIT_THRESHOLD = 100; // remaining
if (response.headers['x-ratelimit-remaining'] < RATE_LIMIT_THRESHOLD) {
  // wait and retry or use cached version
}
```
