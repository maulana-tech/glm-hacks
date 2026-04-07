export interface RepoInfo {
  owner: string;
  repo: string;
}

export interface FileContent {
  path: string;
  content: string;
  sha?: string;
}

export function parseGitHubRepoUrl(url: string): RepoInfo {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) {
    throw new Error("Invalid GitHub URL");
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function getHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CDE-AI",
  };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  return headers;
}

export async function getRepoInfo(token: string, owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to get repo info: ${response.status}`);
  }
  return response.json();
}

export async function listFiles(
  token: string,
  owner: string,
  repo: string,
  path: string = ""
): Promise<{ name: string; path: string; type: "file" | "dir"; size?: number }[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: getHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.status}`);
  }
  const data = await response.json() as any;
  const contents = Array.isArray(data) ? data : [data];
  return contents.map((item: any) => ({
    name: item.name,
    path: item.path,
    type: item.type as "file" | "dir",
    size: item.size,
  }));
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<FileContent> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to get file: ${response.status}`);
  }
  const content = (await response.json()) as any;
  if (!content.content) {
    throw new Error("Path is a directory");
  }
  return {
    path: content.path,
    content: Buffer.from(content.content, "base64").toString("utf-8"),
    sha: content.sha,
  };
}

export async function updateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string = "main",
  sha?: string
) {
  const body: any = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      ...getHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update file: ${response.status} - ${error}`);
  }
  return response.json();
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string = "main"
) {
  const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`, {
    headers: getHeaders(token),
  });
  if (!refResponse.ok) {
    throw new Error(`Failed to get ref: ${refResponse.status}`);
  }
  const refData = await refResponse.json() as any;
  const sha = refData.object.sha;

  const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: {
      ...getHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create branch: ${createResponse.status} - ${error}`);
  }
  return { branch: branchName, sha };
}

export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string = "main"
) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      ...getHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, head, base }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PR: ${response.status} - ${error}`);
  }
  return response.json();
}

export async function getCurrentUser(token: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: getHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to get user: ${response.status}`);
  }
  return response.json();
}
