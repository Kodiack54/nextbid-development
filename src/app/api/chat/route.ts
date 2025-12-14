import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const PROJECTS_BASE_PATH = '/var/www/NextBid_Dev';
const ALLOWED_COMMANDS = ['npm', 'npx', 'git', 'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'pwd'];

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

const TOOLS = [
  { name: 'read_file', description: 'Read a file from the project', input_schema: { type: 'object', properties: { file_path: { type: 'string', description: 'Path relative to project root' } }, required: ['file_path'] } },
  { name: 'write_file', description: 'Write or update a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'list_files', description: 'List files in a directory', input_schema: { type: 'object', properties: { directory: { type: 'string', description: 'Use "." for root' } }, required: ['directory'] } },
  { name: 'search_files', description: 'Search for text in files', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, file_pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'query_database', description: 'Query Supabase database', input_schema: { type: 'object', properties: { table: { type: 'string' }, select: { type: 'string' }, filters: { type: 'object' }, limit: { type: 'number' } }, required: ['table', 'select'] } },
  { name: 'insert_database', description: 'Insert row into database', input_schema: { type: 'object', properties: { table: { type: 'string' }, data: { type: 'object' } }, required: ['table', 'data'] } },
  { name: 'update_database', description: 'Update rows in database', input_schema: { type: 'object', properties: { table: { type: 'string' }, data: { type: 'object' }, filters: { type: 'object' } }, required: ['table', 'data', 'filters'] } },
  { name: 'run_command', description: 'Run shell command (npm, git, ls only)', input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } }
];

async function executeTool(toolName: string, toolInput: any, projectPath: string): Promise<string> {
  console.log('[Chad Tool]', toolName, JSON.stringify(toolInput).slice(0, 200));
  try {
    switch (toolName) {
      case 'read_file': {
        const fullPath = path.join(projectPath, toolInput.file_path);
        if (!path.normalize(fullPath).startsWith(path.normalize(projectPath))) throw new Error('Path traversal denied');
        const content = await fs.readFile(fullPath, 'utf-8');
        return content.length > 50000 ? content.slice(0, 50000) + '\n[truncated]' : content;
      }
      case 'write_file': {
        const fullPath = path.join(projectPath, toolInput.file_path);
        if (!path.normalize(fullPath).startsWith(path.normalize(projectPath))) throw new Error('Path traversal denied');
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, toolInput.content, 'utf-8');
        return 'Written: ' + toolInput.file_path;
      }
      case 'list_files': {
        const fullPath = path.join(projectPath, toolInput.directory);
        if (!path.normalize(fullPath).startsWith(path.normalize(projectPath))) throw new Error('Path traversal denied');
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        return JSON.stringify(entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })), null, 2);
      }
      case 'search_files': {
        const pattern = toolInput.pattern.replace(/"/g, '\\"');
        const glob = toolInput.file_pattern || '*';
        try {
          const { stdout } = await execAsync('grep -r -n --include="' + glob + '" "' + pattern + '" . 2>/dev/null | head -50', { cwd: projectPath, timeout: 10000 });
          return stdout || 'No matches';
        } catch { return 'No matches'; }
      }
      case 'query_database': {
        let query = supabase.from(toolInput.table).select(toolInput.select);
        if (toolInput.filters) {
          for (const [k, v] of Object.entries(toolInput.filters)) query = query.eq(k, v);
        }
        const { data, error } = await query.limit(toolInput.limit || 10);
        return error ? 'Error: ' + error.message : JSON.stringify(data, null, 2);
      }
      case 'insert_database': {
        const { data, error } = await supabase.from(toolInput.table).insert(toolInput.data).select();
        return error ? 'Error: ' + error.message : 'Inserted: ' + JSON.stringify(data);
      }
      case 'update_database': {
        let query = supabase.from(toolInput.table).update(toolInput.data);
        for (const [k, v] of Object.entries(toolInput.filters as Record<string, any>)) query = query.eq(k, v);
        const { data, error } = await query.select();
        return error ? 'Error: ' + error.message : 'Updated: ' + JSON.stringify(data);
      }
      case 'run_command': {
        const cmd = toolInput.command.trim().split(/\s+/)[0];
        if (!ALLOWED_COMMANDS.includes(cmd)) return 'Command not allowed: ' + cmd;
        if (toolInput.command.includes('--force') || toolInput.command.includes('-rf') || toolInput.command.includes('sudo')) return 'Dangerous flags not allowed';
        try {
          const { stdout, stderr } = await execAsync(toolInput.command, { cwd: projectPath, timeout: 30000 });
          const out = stdout || stderr || 'Done';
          return out.length > 10000 ? out.slice(0, 10000) + '\n[truncated]' : out;
        } catch (e: any) { return 'Error: ' + e.message; }
      }
      default: return 'Unknown tool: ' + toolName;
    }
  } catch (e: any) { return 'Tool error: ' + e.message; }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  try {
    const body = await request.json();
    const { messages, user_id, project_id, project_path, model = 'claude-sonnet-4-20250514', system_prompt } = body;

    if (!messages?.length) return new Response(JSON.stringify({ error: 'messages required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const projectPath = project_path || path.join(PROJECTS_BASE_PATH, 'dev-studio-5000');

    const systemPrompt = system_prompt || 'You are Chad, the AI assistant in NextBid Dev Studio.\nYou have tools to read/write files, query/update the database, and run commands.\n\nTools: read_file, write_file, list_files, search_files, query_database, insert_database, update_database, run_command\n\nProject Path: ' + projectPath + '\nUser ID: ' + user_id + '\n\nWhen asked about code or data, USE THE TOOLS to actually look. Be proactive!';

    const startTime = Date.now();

    async function callClaude(msgs: any[]) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: msgs, tools: TOOLS }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    let currentMsgs = [...messages];
    let finalResponse: any = null;
    let totalIn = 0, totalOut = 0;
    const toolLog: string[] = [];

    for (let i = 0; i < 10; i++) {
      const response = await callClaude(currentMsgs);
      totalIn += response.usage?.input_tokens || 0;
      totalOut += response.usage?.output_tokens || 0;

      const toolBlocks = response.content.filter((b: any) => b.type === 'tool_use');
      if (!toolBlocks.length) { finalResponse = response; break; }

      const results: any[] = [];
      for (const tb of toolBlocks) {
        toolLog.push(tb.name);
        results.push({ type: 'tool_result', tool_use_id: tb.id, content: await executeTool(tb.name, tb.input, projectPath) });
      }
      currentMsgs.push({ role: 'assistant', content: response.content });
      currentMsgs.push({ role: 'user', content: results });
    }

    if (!finalResponse) return new Response(JSON.stringify({ error: 'Too many tool iterations' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const text = finalResponse.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const cost = calculateCost(model, totalIn, totalOut);

    await supabase.from('dev_ai_usage').insert({
      user_id, project_id, model, input_tokens: totalIn, output_tokens: totalOut, cost_usd: cost,
      request_type: toolLog.length ? 'chat_with_tools' : 'chat',
      prompt_preview: typeof messages[messages.length - 1]?.content === 'string' ? messages[messages.length - 1].content.slice(0, 255) : 'Tool session',
      response_time_ms: Date.now() - startTime,
    });

    const content = toolLog.length ? text + '\n\n---\n*Tools: ' + toolLog.join(' > ') + '*' : text;

    const stream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'content', text: content }) + '\n\n'));
        ctrl.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'done', usage: { input_tokens: totalIn, output_tokens: totalOut, cost_usd: cost, tools_used: toolLog.length } }) + '\n\n'));
        ctrl.close();
      },
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (e: any) {
    console.error('Chat error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
