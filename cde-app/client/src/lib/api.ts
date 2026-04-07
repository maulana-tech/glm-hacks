import type { AgentAnalysisResponse, DetectedProcess, GraphData, LLMConfig } from '../types/graph';

const BASE = '/api';
const HEALTH_ENDPOINT = '/health';

async function isLocalBackendReachable(): Promise<boolean> {
    try {
        const res = await fetch(HEALTH_ENDPOINT, { method: 'GET' });
        return res.ok;
    } catch {
        return false;
    }
}

async function buildApiError(res: Response): Promise<Error> {
    const contentType = res.headers.get('content-type') || '';
    let message = res.statusText || `Server error ${res.status}`;

    if (contentType.includes('application/json')) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        message = body?.error ?? message;
    } else {
        const text = await res.text().catch(() => '');
        if (text.trim()) {
            message = text
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
    }

    if (!message || /^error$/i.test(message)) {
        message = `Server error ${res.status}`;
    }

    if (res.status === 413) {
        return new Error(message || 'Repository archive is too large for the current CDE AI upload limit.');
    }

    if (res.status >= 500 && /internal server error/i.test(message)) {
        return new Error('CDE AI could not process this repository. Try a smaller ZIP or a repo root without build artifacts.');
    }

    if (
        res.status >= 500 &&
        message.toLowerCase().includes('internal server error') &&
        !(await isLocalBackendReachable())
    ) {
        return new Error('CDE AI backend is not reachable. Start the server in `vectron-app` and refresh the page.');
    }

    return new Error(message || `Server error ${res.status}`);
}

async function fetchFromApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(input, init);
    } catch (error) {
        if (!(await isLocalBackendReachable())) {
            throw new Error('CDE AI backend is not reachable. Start the server in `vectron-app` and refresh the page.');
        }

        throw error instanceof Error ? error : new Error('Network request failed');
    }
}

/** Upload a zip file and receive the parsed graph JSON. */
export async function uploadZip(file: File): Promise<GraphData> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetchFromApi(`${BASE}/upload`, { method: 'POST', body: form });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json() as Promise<GraphData>;
}

export async function cloneGithubRepo(githubUrl: string): Promise<GraphData> {
    const res = await fetchFromApi(`${BASE}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json() as Promise<GraphData>;
}

/** Fetch source code of a specific file from the server cache. */
export async function fetchFile(filePath: string): Promise<string> {
    const res = await fetchFromApi(`${BASE}/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) {
        throw await buildApiError(res);
    }
    const data = await res.json();
    return data.content;
}

export async function detectProcesses(graphData: GraphData, focusNode?: string | null): Promise<DetectedProcess[]> {
    const res = await fetchFromApi(`${BASE}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData, focusNode: focusNode || undefined }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    const body = await res.json().catch(() => ({ processes: [] }));
    return Array.isArray(body.processes) ? body.processes : [];
}

export async function queryCodebase(
    graphData: GraphData,
    question: string,
    llmConfig?: LLMConfig,
): Promise<{ explanation: string; relevantNodes: string[]; provider: string }> {
    const res = await fetchFromApi(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData, question, llmConfig }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    const body = await res.json().catch(() => ({
        explanation: '',
        relevantNodes: [],
        provider: '',
    }));

    return {
        explanation: typeof body.explanation === 'string' ? body.explanation : '',
        relevantNodes: Array.isArray(body.relevantNodes) ? body.relevantNodes : [],
        provider: typeof body.provider === 'string' ? body.provider : '',
    };
}

export async function fetchNodeSummary(
    graphData: GraphData,
    nodeId: string,
    label: string,
    type: string,
): Promise<string> {
    const res = await fetchFromApi(`${BASE}/node-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData, nodeId, label, type }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    const body = await res.json().catch(() => ({
        summary: '',
    }));

    return typeof body.summary === 'string' ? body.summary : '';
}

export async function generateReport(graphData: GraphData): Promise<string> {
    const res = await fetchFromApi(`${BASE}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    const body = await res.json().catch(() => ({ report: '' }));
    return typeof body.report === 'string' ? body.report : '';
}

export async function generateAgentAnalysis(graphData: GraphData): Promise<AgentAnalysisResponse> {
    const res = await fetchFromApi(`${BASE}/agent-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    const body = await res.json().catch(() => ({
        agents: {
            security: { title: 'Security Analysis', icon: '🔴', content: '' },
            architecture: { title: 'Architecture Review', icon: '🔵', content: '' },
            performance: { title: 'Performance Audit', icon: '🟡', content: '' },
            quality: { title: 'Code Quality', icon: '🟢', content: '' },
            onboarding: { title: 'Onboarding Guide', icon: '⚡', content: '' },
        },
        generatedAt: '',
    }));

    return body as AgentAnalysisResponse;
}

export interface GitHubFile {
    name: string;
    path: string;
    type: "file" | "dir";
    size?: number;
}

export interface GitHubPR {
    number: number;
    url: string;
    title: string;
    state: string;
}

export async function listGitHubFiles(githubUrl: string, path: string = "", token?: string): Promise<{ owner: string; repo: string; files: GitHubFile[] }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetchFromApi(`${BASE}/github/files`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ githubUrl, path }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json();
}

export async function getGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<{ path: string; content: string; sha: string }> {
    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetchFromApi(`${BASE}/github/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`, {
        method: 'GET',
        headers,
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json();
}

export async function createGitHubBranch(owner: string, repo: string, branchName: string, baseBranch: string = "main", token?: string): Promise<{ branch: string; sha: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetchFromApi(`${BASE}/github/branch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ owner, repo, branchName, baseBranch }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json();
}

export async function updateGitHubFile(owner: string, repo: string, path: string, content: string, message: string, branch: string = "main", sha?: string, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetchFromApi(`${BASE}/github/file`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ owner, repo, path, content, message, branch, sha }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json();
}

export async function createGitHubPR(owner: string, repo: string, title: string, body: string, head: string, base: string = "main", token?: string): Promise<GitHubPR> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetchFromApi(`${BASE}/github/pr`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ owner, repo, title, body, head, base }),
    });

    if (!res.ok) {
        throw await buildApiError(res);
    }

    return res.json();
}

export interface GitHubUser {
    authenticated: boolean;
    user?: {
        id: number;
        login: string;
        name: string;
        email: string;
        avatar_url: string;
    };
    error?: string;
}

export async function getGitHubUser(): Promise<GitHubUser> {
    const res = await fetchFromApi(`${BASE}/github/me`, {
        method: 'GET',
    });
    
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to get user' }));
        return { authenticated: false, error: error.error };
    }
    
    return res.json();
}

export async function logoutGitHub(): Promise<void> {
    await fetchFromApi(`${BASE}/github/logout`, {
        method: 'POST',
    });
}
