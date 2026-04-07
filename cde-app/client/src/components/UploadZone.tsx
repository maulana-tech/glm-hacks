import { useEffect, useRef, useState, useCallback } from 'react';
import { cloneGithubRepo, uploadZip, getGitHubUser } from '../lib/api';
import type { GraphData } from '../types/graph';

interface UploadZoneProps {
    onGraph: (data: GraphData) => void;
}

type UploadMode = 'zip' | 'github';
type LoadingMode = 'zip' | 'github' | null;

const GITHUB_LOADING_STEPS = [
    'Cloning repository...',
    'Parsing files...',
    'Building graph...',
] as const;

const EXAMPLE_REPOS = [
    'facebook/react',
    'expressjs/express',
    'microsoft/typescript',
] as const;

function buildGithubUrl(example: string) {
    return `https://github.com/${example}`;
}

export default function UploadZone({ onGraph }: UploadZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<UploadMode>('zip');
    const [dragging, setDragging] = useState(false);
    const [loadingMode, setLoadingMode] = useState<LoadingMode>(null);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [githubUrl, setGithubUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [githubUser, setGithubUser] = useState<{ authenticated: boolean; user?: { login: string; name: string; avatar_url: string } } | null>(null);

    const isLoading = loadingMode !== null;
    const canAnalyzeGithub = githubUrl.trim().length > 0 && !isLoading;

    useEffect(() => {
        getGitHubUser().then(setGithubUser).catch(() => setGithubUser({ authenticated: false }));
    }, []);

    useEffect(() => {
        if (loadingMode !== 'github') {
            setLoadingStepIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setLoadingStepIndex((current) => {
                if (current >= GITHUB_LOADING_STEPS.length - 1) {
                    return current;
                }
                return current + 1;
            });
        }, 1100);

        return () => window.clearInterval(interval);
    }, [loadingMode]);

    const handleFile = useCallback(async (file: File) => {
        if (!file.name.endsWith('.zip')) {
            setError('Please upload a .zip file.');
            return;
        }

        setError(null);
        setLoadingMode('zip');

        try {
            const graph = await uploadZip(file);
            onGraph(graph);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setLoadingMode(null);
        }
    }, [onGraph]);

    const handleGithubAnalyze = useCallback(async () => {
        setError(null);
        setLoadingStepIndex(0);
        setLoadingMode('github');

        try {
            const graph = await cloneGithubRepo(githubUrl.trim());
            onGraph(graph);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Repository analysis failed');
        } finally {
            setLoadingMode(null);
        }
    }, [githubUrl, onGraph]);

    const handleGitHubConnect = () => {
        window.location.href = '/api/github/auth';
    };

    const currentGithubStep = GITHUB_LOADING_STEPS[loadingStepIndex];

    return (
        <div className="upload-overlay">
            <input
                ref={inputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                }}
            />

            <div className={`upload-box ${dragging ? 'drag' : ''} ${mode === 'github' ? 'is-form' : ''}`}>
                <div className="upload-header-section">
                    <div className="upload-brand">
                        <span className="upload-brand-icon">❖</span>
                        <span className="upload-brand-text">CDE AI</span>
                    </div>
                    <div className="upload-header-subtitle">Dependency Propagation Engine</div>
                </div>

                {githubUser?.authenticated && (
                    <div className="upload-github-status">
                        <img src={githubUser.user?.avatar_url} alt="" className="upload-github-avatar" />
                        <span className="upload-github-name">Connected as {githubUser.user?.login}</span>
                        <span className="upload-github-badge">✓</span>
                    </div>
                )}

                <div className="upload-tabs" role="tablist" aria-label="Repository input mode">
                    <button
                        type="button"
                        className={`upload-tab ${mode === 'zip' ? 'active' : ''}`}
                        onClick={() => {
                            setMode('zip');
                            setError(null);
                        }}
                        disabled={isLoading}
                    >
                        <span className="upload-tab-icon">↑</span>
                        <span className="upload-tab-label">Upload ZIP</span>
                    </button>
                    <button
                        type="button"
                        className={`upload-tab ${mode === 'github' ? 'active' : ''}`}
                        onClick={() => {
                            setMode('github');
                            setError(null);
                        }}
                        disabled={isLoading}
                    >
                        <span className="upload-tab-icon">⌘</span>
                        <span className="upload-tab-label">GitHub</span>
                    </button>
                </div>

                {mode === 'zip' ? (
                    <div
                        className="upload-pane"
                        onClick={() => !isLoading && inputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            const f = e.dataTransfer.files[0];
                            if (f) handleFile(f);
                        }}
                    >
                        <div className="upload-icon-large" aria-hidden="true">
                            {loadingMode === 'zip' ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className="spinner" />
                                </div>
                            ) : (
                                <div className="upload-icon-circle">
                                    <span>↑</span>
                                </div>
                            )}
                        </div>

                        <div className="upload-title">
                            {loadingMode === 'zip' ? 'Parsing repository...' : 'Upload Repository'}
                        </div>
                        <div className="upload-sub">
                            {loadingMode === 'zip'
                                ? 'Building knowledge graph from AST'
                                : 'Drag and drop a .zip file or click to browse'}
                        </div>
                        <div className="upload-formats">
                            <span className="upload-format-badge">JS</span>
                            <span className="upload-format-badge">TS</span>
                            <span className="upload-format-badge">JSX</span>
                            <span className="upload-format-badge">TSX</span>
                            <span className="upload-format-badge">PY</span>
                            <span className="upload-format-badge">+more</span>
                        </div>
                    </div>
                ) : (
                    <div className="upload-pane upload-pane-form">
                        {!githubUser?.authenticated && (
                            <div className="upload-github-connect">
                                <div className="upload-github-connect-icon">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                </div>
                                <div className="upload-github-connect-text">
                                    <span className="upload-github-connect-title">Connect to GitHub</span>
                                    <span className="upload-github-connect-sub">Access private repos & more</span>
                                </div>
                                <button type="button" className="upload-github-connect-btn" onClick={handleGitHubConnect}>
                                    Connect
                                </button>
                            </div>
                        )}

                        <div className="upload-icon-large" aria-hidden="true">
                            {loadingMode === 'github' ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className="spinner" />
                                </div>
                            ) : (
                                <div className="upload-icon-circle secondary">
                                    <span>⌘</span>
                                </div>
                            )}
                        </div>

                        <div className="upload-title">
                            {loadingMode === 'github' ? currentGithubStep : 'Analyze GitHub Repository'}
                        </div>
                        <div className="upload-sub">
                            {loadingMode === 'github'
                                ? 'Fetching the latest commit snapshot directly from GitHub'
                                : 'Paste a public GitHub repository URL to analyze it instantly'}
                        </div>

                        <input
                            type="url"
                            className="upload-github-input"
                            value={githubUrl}
                            onChange={(event) => setGithubUrl(event.target.value)}
                            placeholder="https://github.com/username/repository"
                            disabled={isLoading}
                        />

                        <button
                            type="button"
                            className="upload-analyze-btn"
                            onClick={handleGithubAnalyze}
                            disabled={!canAnalyzeGithub}
                        >
                            {loadingMode === 'github' ? (
                                <>
                                    <span className="spinner" />
                                    {currentGithubStep}
                                </>
                            ) : (
                                'ANALYZE REPOSITORY →'
                            )}
                        </button>

                        <div className="upload-examples">
                            <span className="upload-examples-label">Try these:</span>
                            <div className="upload-example-list">
                                {EXAMPLE_REPOS.map((example) => (
                                    <button
                                        key={example}
                                        type="button"
                                        className="upload-example-chip"
                                        onClick={() => setGithubUrl(buildGithubUrl(example))}
                                        disabled={isLoading}
                                    >
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className="upload-error">{error}</div>}

                <div className="upload-footer">
                    <div className="upload-footer-divider" />
                    <div className="upload-footer-text">
                        Supports JavaScript · TypeScript · Python · JSON · YAML · Markdown
                    </div>
                </div>
            </div>
        </div>
    );
}