# GitHub Actions Integration - Planning

## Goal
Enable CDE AI to perform GitHub operations (audit, PR creation, code changes) using GitHub API or GitHub App authentication.

---

## Current State
- ZIP upload: Works
- GitHub URL clone: Works (downloads ZIP)
- GitHub token: Supported for higher rate limits

---

## Feature Requirements

### 1. GitHub Authentication Options
| Option | Use Case | Pros | Cons |
|--------|----------|------|------|
| Personal Access Token (PAT) | User provides own token | Simple | Limited to user's permissions |
| GitHub App | Enterprise/deployment | Better permissions control | Complex setup |
| OAuth | User login flow | Secure, user context | Most complex |

### 2. Operations to Support
- [ ] Clone repository (already exists)
- [ ] List files & branches
- [ ] Read file contents
- [ ] Create branch
- [ ] Update/create file
- [ ] Create Pull Request
- [ ] Get PR status
- [ ] Add PR comments
- [ ] Run code review/audit

### 3. AI Workflow Examples

#### Code Audit Flow
```
1. User provides GitHub URL + optional PAT
2. CDE AI clones repo
3. AI analyzes code structure
4. AI generates audit report (security, quality, etc.)
5. If changes needed → create PR with fixes
```

#### Automated Refactor Flow
```
1. User asks "refactor function X"
2. CDE AI analyzes impact
3. AI makes changes to files
4. AI creates PR with description
```

---

## Technical Implementation

### API Endpoints to Add
```
POST /api/github/clone        - Clone repo with auth
GET  /api/github/files        - List repo files
GET  /api/github/file/:path   - Get file content
POST /api/github/file         - Create/update file
POST /api/github/branch      - Create branch
POST /api/github/pr           - Create PR
GET  /api/github/pr/:number   - Get PR status
```

### Environment Variables
```
GITHUB_APP_ID=                # For GitHub App
GITHUB_APP_PRIVATE_KEY=       # For GitHub App  
GITHUB_TOKEN=                 # User PAT (optional)
```

### Server-Side Implementation
1. Add GitHub API client (octokit)
2. Add new API endpoints
3. Add GitHub operations to MCP tools

### Frontend Updates
1. Add GitHub auth section in settings
2. Add "Create PR" button in report view
3. Add audit results with "Create PR" option

---

## MCP Tools to Add
```
github_list_files(path?)
github_get_file(path)
github_update_file(path, content, message)
github_create_branch(branch_name, base)
github_create_pr(title, body, branch)
github_review_pr(pr_number, body)
```

---

## Security Considerations
- Store tokens encrypted
- Don't log sensitive data
- Rate limit per user
- Validate all inputs
- Sanitize file paths (prevent directory traversal)

---

## UI/UX Flow

### Option 1: Settings-based
1. User goes to Settings
2. Enters GitHub PAT (or uses existing GITHUB_TOKEN)
3. All operations use that token

### Option 2: Per-operation
1. User initiates action (e.g., "Create Fix PR")
2. Prompt for PAT if not configured
3. Perform operation

---

## Implementation Priority
1. **Phase 1**: Basic - User provides PAT, can create PR with audit fixes
2. **Phase 2**: Advanced - GitHub App support, automated refactor
3. **Phase 3**: Pro - Multi-repo support, scheduled audits

---

## Questions for User
1. Which auth method prefer? (PAT simplest for now)
2. Which specific operations needed first?
3. How should PR creation UI work?
