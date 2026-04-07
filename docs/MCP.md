# CDE AI MCP Integration Guide

## Overview
CDE AI exposes a Model Context Protocol (MCP) server on port 3002,
giving AI coding assistants structural codebase context.

## Quick Setup

### Antigravity / OpenCode
Add to MCP settings:
- Name: CDE AI
- URL: http://localhost:3002/sse
- Type: Streamable HTTP

### Claude Code
Add to ~/.claude/mcp.json:
```json
{
  "mcpServers": {
    "cde-ai": {
      "url": "http://localhost:3002/sse",
      "type": "http"
    }
  }
}
```

### Cursor
Add to ~/.cursor/mcp.json:
```json
{
  "mcpServers": {
    "cde-ai": {
      "command": "node",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

## Tools Reference

### cde-ai_status
Check if a graph is loaded.
No parameters required.
Example: "Use CDE AI to check status"

### cde-ai_blast_radius
Find all nodes affected by changing a given node.
Parameters:
- nodeLabel (string, required): name of the node
- depth (number, optional, default 3): how many hops to trace
Example: "Use CDE AI to find blast radius of GraphView2D"

### cde-ai_get_callers
Find everything that calls or imports a given node.
Parameters:
- nodeLabel (string, required): name of the node
Example: "Use CDE AI to find everything that calls handleUpload"

### cde-ai_get_dependencies
Find everything a given node depends on.
Parameters:
- nodeLabel (string, required): name of the node
Example: "Use CDE AI to find what App.tsx depends on"

### cde-ai_query
Ask a natural language question about the codebase.
Parameters:
- question (string, required): your question
Example: "Use CDE AI to answer: how does authentication work?"

## Example Workflow

1. Start CDE AI locally:
   `cd cde-ai-app && npm run dev`

2. Upload your codebase at `localhost:5173`

3. Connect MCP in your editor

4. Ask your AI assistant:
   "I want to refactor the parseAST function.
    Use CDE AI to check the blast radius first."

5. AI automatically calls `cde-ai_blast_radius("parseAST")`
   and returns every affected file before touching anything.
