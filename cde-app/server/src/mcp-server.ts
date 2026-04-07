import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { getGraph, hasGraph } from "./graph-store";
import { callLLM } from "./index";
import { parseGitHubRepoUrl, listFiles, getFileContent, updateFile, createBranch, createPullRequest } from "./github";

const mcpApp = express();
const server = new McpServer({
  name: "cde-ai",
  version: "1.0.0",
});

mcpApp.use(express.json());

server.tool("cde-ai_status", "Check if CDE AI has a graph loaded", {}, async () => {
  if (!hasGraph()) {
    return {
      content: [{ type: "text", text: "No graph loaded. Upload a ZIP to CDE AI first." }],
    };
  }

  const graph = getGraph();
  return {
    content: [
      {
        type: "text",
        text: `Graph loaded: ${graph?.nodes.length ?? 0} nodes, ${graph?.edges.length ?? 0} edges`,
      },
    ],
  };
});

server.tool(
  "cde-ai_blast_radius",
  "Find all nodes affected if a given node is changed. Returns the blast radius.",
  { nodeLabel: z.string(), depth: z.number().optional() },
  async ({ nodeLabel, depth = 3 }) => {
    const graph = getGraph();
    if (!graph) {
      return { content: [{ type: "text", text: "No graph loaded." }] };
    }

    const node = graph.nodes.find(
      (candidate) => candidate.label.toLowerCase() === nodeLabel.toLowerCase(),
    );
    if (!node) {
      return {
        content: [{ type: "text", text: `Node "${nodeLabel}" not found.` }],
      };
    }

    const visited = new Set<string>();
    const queue: Array<{ id: string; d: number }> = [{ id: node.id, d: 0 }];
    const affected: Array<{ label: string; type: string; depth: number }> = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const { id, d } = current;
      if (visited.has(id) || d > depth) continue;
      visited.add(id);

      const currentNode = graph.nodes.find((candidate) => candidate.id === id);
      if (currentNode && id !== node.id) {
        affected.push({ label: currentNode.label, type: currentNode.type, depth: d });
      }

      graph.edges
        .filter((edge) => edge.source === id)
        .forEach((edge) => queue.push({ id: edge.target, d: d + 1 }));
    }

    const summary =
      affected.length === 0
        ? `No downstream dependencies found for "${nodeLabel}"`
        : `Changing "${nodeLabel}" affects ${affected.length} nodes:\n${affected
            .map((item) => `  depth ${item.depth}: ${item.label} (${item.type})`)
            .join("\n")}`;

    return { content: [{ type: "text", text: summary }] };
  },
);

server.tool(
  "cde-ai_get_callers",
  "Find all nodes that call or depend on a given node",
  { nodeLabel: z.string() },
  async ({ nodeLabel }) => {
    const graph = getGraph();
    if (!graph) {
      return { content: [{ type: "text", text: "No graph loaded." }] };
    }

    const node = graph.nodes.find(
      (candidate) => candidate.label.toLowerCase() === nodeLabel.toLowerCase(),
    );
    if (!node) {
      return {
        content: [{ type: "text", text: `Node "${nodeLabel}" not found.` }],
      };
    }

    const callers = graph.edges
      .filter((edge) => edge.target === node.id)
      .map((edge) => {
        const caller = graph.nodes.find((candidate) => candidate.id === edge.source);
        return caller ? `${caller.label} (${caller.type}) via ${edge.kind}` : edge.source;
      });

    const text =
      callers.length === 0
        ? `Nothing calls "${nodeLabel}"`
        : `${callers.length} callers of "${nodeLabel}":\n${callers
            .map((caller) => `  - ${caller}`)
            .join("\n")}`;

    return { content: [{ type: "text", text }] };
  },
);

server.tool(
  "cde-ai_get_dependencies",
  "Find everything a given node depends on",
  { nodeLabel: z.string() },
  async ({ nodeLabel }) => {
    const graph = getGraph();
    if (!graph) {
      return { content: [{ type: "text", text: "No graph loaded." }] };
    }

    const node = graph.nodes.find(
      (candidate) => candidate.label.toLowerCase() === nodeLabel.toLowerCase(),
    );
    if (!node) {
      return {
        content: [{ type: "text", text: `Node "${nodeLabel}" not found.` }],
      };
    }

    const dependencies = graph.edges
      .filter((edge) => edge.source === node.id)
      .map((edge) => {
        const dependency = graph.nodes.find((candidate) => candidate.id === edge.target);
        return dependency ? `${dependency.label} (${dependency.type}) via ${edge.kind}` : edge.target;
      });

    const text =
      dependencies.length === 0
        ? `"${nodeLabel}" has no dependencies`
        : `"${nodeLabel}" depends on ${dependencies.length} nodes:\n${dependencies
            .map((dependency) => `  - ${dependency}`)
            .join("\n")}`;

    return { content: [{ type: "text", text }] };
  },
);

server.tool(
  "cde-ai_query",
  "Ask a natural language question about the codebase",
  { question: z.string() },
  async ({ question }) => {
    const graph = getGraph();
    if (!graph) {
      return { content: [{ type: "text", text: "No graph loaded." }] };
    }

    const summary = graph.nodes
      .slice(0, 100)
      .map((node) => `${node.id}|${node.label}|${node.type}`)
      .join("\n");

    const systemPrompt =
      "You are an expert codebase analyst. Answer questions about this codebase graph concisely.";
    const userMessage = `Graph nodes:\n${summary}\n\nQuestion: ${question}`;

    try {
      const answer = await callLLM(systemPrompt, userMessage);
      return { content: [{ type: "text", text: answer.content }] };
    } catch {
      return { content: [{ type: "text", text: "Failed to query LLM." }] };
    }
  },
);

server.tool(
  "github_list_files",
  "List files in a GitHub repository",
  { repoUrl: z.string(), path: z.string().optional() },
  async ({ repoUrl, path = "" }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { content: [{ type: "text", text: "GITHUB_TOKEN not configured on server." }] };
    }

    try {
      const { owner, repo } = parseGitHubRepoUrl(repoUrl);
      const files = await listFiles(token, owner, repo, path);
      const fileList = files.map((f) => `${f.type === "dir" ? "[DIR]" : "[FILE]"} ${f.path}`).join("\n");
      return { content: [{ type: "text", text: fileList || "No files found" }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  },
);

server.tool(
  "github_get_file",
  "Get content of a file from GitHub repository",
  { repoUrl: z.string(), path: z.string() },
  async ({ repoUrl, path }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { content: [{ type: "text", text: "GITHUB_TOKEN not configured on server." }] };
    }

    try {
      const { owner, repo } = parseGitHubRepoUrl(repoUrl);
      const file = await getFileContent(token, owner, repo, path);
      return { content: [{ type: "text", text: `File: ${file.path}\n\n${file.content}` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  },
);

server.tool(
  "github_create_branch",
  "Create a new branch in GitHub repository",
  { repoUrl: z.string(), branchName: z.string(), baseBranch: z.string().optional() },
  async ({ repoUrl, branchName, baseBranch = "main" }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { content: [{ type: "text", text: "GITHUB_TOKEN not configured on server." }] };
    }

    try {
      const { owner, repo } = parseGitHubRepoUrl(repoUrl);
      await createBranch(token, owner, repo, branchName, baseBranch);
      return { content: [{ type: "text", text: `Branch "${branchName}" created successfully.` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  },
);

server.tool(
  "github_update_file",
  "Update or create a file in GitHub repository",
  { repoUrl: z.string(), path: z.string(), content: z.string(), message: z.string(), branch: z.string().optional() },
  async ({ repoUrl, path, content, message, branch = "main" }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { content: [{ type: "text", text: "GITHUB_TOKEN not configured on server." }] };
    }

    try {
      const { owner, repo } = parseGitHubRepoUrl(repoUrl);
      await updateFile(token, owner, repo, path, content, message, branch);
      return { content: [{ type: "text", text: `File "${path}" updated successfully.` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  },
);

server.tool(
  "github_create_pr",
  "Create a pull request in GitHub repository",
  { repoUrl: z.string(), title: z.string(), body: z.string(), head: z.string(), base: z.string().optional() },
  async ({ repoUrl, title, body, head, base = "main" }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { content: [{ type: "text", text: "GITHUB_TOKEN not configured on server." }] };
    }

    try {
      const { owner, repo } = parseGitHubRepoUrl(repoUrl);
      const pr = await createPullRequest(token, owner, repo, title, body, head, base) as any;
      return { content: [{ type: "text", text: `PR created: ${pr.html_url}` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  },
);

const transports: Record<string, SSEServerTransport> = {};

mcpApp.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports[sessionId] = transport;

  transport.onclose = () => {
    delete transports[sessionId];
  };

  await server.connect(transport);
});

mcpApp.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) {
    res.status(400).send("Missing sessionId parameter");
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

export const startMCPServer = () => {
  mcpApp.listen(3002, () => {
    console.log("[CDE AI MCP] Server running on http://localhost:3002/sse");
  });
};
