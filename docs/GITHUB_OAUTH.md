# GitHub OAuth Implementation Plan

## Current State
- GitHub authentication uses PAT (Personal Access Token)
- User manually enters token in settings

## Goal
- GitHub OAuth login flow - click to authenticate
- Get user's identity and permissions automatically
- More secure and user-friendly

---

## GitHub OAuth Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ User     │────▶│ CDE AI      │────▶│ GitHub OAuth │────▶│ GitHub     │
│ clicks   │     │ Login       │     │ redirect     │     │ Auth page  │
│ "Login"  │     │ button      │     │              │     │            │
└──────────┘     └─────────────┘     └──────────────┘     └─────────────┘
                                                              │
                                                              ▼
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ CDE AI   │◀────│ Store      │◀────│ Callback     │◀────│ GitHub     │
│ App      │     │ token      │     │ with code    │     │ returns    │
│ logged   │     │ in cookie  │     │              │     │ code       │
└──────────┘     └─────────────┘     └──────────────┘     └─────────────┘
```

---

## Implementation Steps

### Phase 1: GitHub OAuth App Setup

1. **Create GitHub OAuth App**
   - Go to: https://github.com/settings/developers
   - Click "New OAuth App"
   - Fill details:
     - Application name: CDE AI
     - Homepage URL: https://cde-ai-production.up.railway.app
     - Authorization callback URL: `https://cde-ai-production.up.railway.app/api/github/callback`
   - Get `CLIENT_ID` and `CLIENT_SECRET`

2. **Add environment variables**
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```

---

### Phase 2: Backend Implementation

**New Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/github/auth` | GET | Redirect to GitHub OAuth |
| `/api/github/callback` | GET | Handle OAuth callback |
| `/api/github/me` | GET | Get current user info |
| `/api/github/logout` | POST | Clear auth session |

**Implementation:**
```typescript
// OAuth config
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

// 1. Auth redirect
app.get("/api/github/auth", (req, res) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "repo user:email",
    state: generateStateToken(),
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// 2. Callback
app.get("/api/github/callback", async (req, res) => {
  const { code, state } = req.query;
  
  // Exchange code for token
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  
  const { access_token } = await tokenResponse.json();
  
  // Set cookie
  res.cookie("github_token", access_token, { httpOnly: true });
  res.redirect("/app");
});

// 3. Get user
app.get("/api/github/me", async (req, res) => {
  const token = req.cookies.github_token;
  // Fetch user info from GitHub
});
```

---

### Phase 3: Frontend Implementation

**UI Changes:**
1. Add "Login with GitHub" button in header/settings
2. Show user avatar when logged in
3. Auto-use OAuth token for API calls

**Flow:**
```typescript
// In Header.tsx or Settings
const handleLogin = () => {
  window.location.href = "/api/github/auth";
};

const handleLogout = () => {
  fetch("/api/github/logout", { method: "POST" });
  window.location.reload();
};
```

---

### Phase 4: MCP Integration

Update MCP tools to use cookie-based auth:
```typescript
// Get token from cookie instead of env
const token = req.cookies.github_token || process.env.GITHUB_TOKEN;
```

---

## Security Considerations

1. **State parameter** - Prevent CSRF attacks
2. **HttpOnly cookies** - Prevent XSS token theft
3. **Token encryption** - Store encrypted in cookie
4. **Scope limiting** - Request minimum necessary permissions
5. **Token refresh** - Handle token expiration

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/src/index.ts` | Add OAuth endpoints |
| `server/src/github.ts` | Update to use cookie token |
| `client/src/App.tsx` | Add login UI state |
| `client/src/components/Header.tsx` | Add GitHub login button |
| `client/src/lib/api.ts` | Use OAuth token |
| `.env.example` | Add OAuth vars |
| `railway.json` | Add environment variables |

---

## Environment Variables

```env
# GitHub OAuth (for production)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://cde-ai-production.up.railway.app/api/github/callback

# Existing
GITHUB_TOKEN=  # Fallback if OAuth not configured
```

---

## Questions

1. Want me to implement this now?
2. Should I use a different callback URL for local development?
3. Which permissions scope? (repo for full access, read:user for basic)
