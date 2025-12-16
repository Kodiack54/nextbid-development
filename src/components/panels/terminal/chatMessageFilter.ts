// Chat message filtering - strips TUI noise from terminal output

/**
 * Clean ANSI escape codes from terminal output
 * Note: Be selective - don't strip everything or box drawing chars break
 */
export function cleanAnsiCodes(data: string): string {
  return data
    // Strip color and formatting codes (SGR - Select Graphic Rendition)
    .replace(/\x1b\[[0-9;]*m/g, '')
    // Strip cursor movement codes (A=up, B=down, C=forward, D=back, etc)
    .replace(/\x1b\[[0-9;]*[ABCDEFGHJKSTfnsu]/g, '')
    // Strip erase codes (J=screen, K=line)
    .replace(/\x1b\[[0-9;]*[JK]/g, '')
    // Strip cursor visibility/mode sequences
    .replace(/\x1b\[\?[0-9;]*[hl]/g, '')
    // Strip OSC sequences (title bar, etc) - ends with BEL or ST
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Strip remaining OSC that might not be properly terminated
    .replace(/\x1b\][^\x07]*\x07/g, '')
    // DON'T strip all \x1b - that breaks legitimate characters
    // DON'T strip control chars 0x00-0x1F blanket - breaks formatting
    // Strip carriage returns (keep newlines)
    .replace(/\r(?!\n)/g, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Check if a line should be filtered from chat display
 */
export function shouldFilterLine(trimmed: string): boolean {
  // Empty lines at start are skipped by caller
  if (!trimmed) return false; // Let caller handle empty line logic

  // FILTER Susan's briefing content - don't show in chat (it's visible in terminal)
  if (trimmed.includes('LAST SESSION') ||
      trimmed.includes('RECENT CONVERSATION') ||
      trimmed.includes('KEY KNOWLEDGE') ||
      trimmed.includes('END BRIEFING') ||
      trimmed.includes("I've gathered") ||
      trimmed.includes('Ready to continue') ||
      trimmed.includes("What's the priority") ||
      trimmed.includes('Summary:') ||
      trimmed.startsWith('You:') ||
      trimmed.startsWith('Claude:') ||
      // Susan's knowledge category tags like [ug-fix], [rchitecture], [onfig]
      /^\s*\w*-?\w*\]/.test(trimmed) ||
      /\[[\w-]+\]/.test(trimmed) ||
      // Briefing emojis
      /^[⏰💬🧠📋]/.test(trimmed) ||
      // Partial escape codes that leak through
      /^\[\d+/.test(trimmed) ||
      trimmed === 'm' ||
      trimmed === 'claude') return true;

  // Spinners and thinking indicators
  if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏·✢✶✻✽∴]+/.test(trimmed)) return true;
  if (/Flibbertigibbet|Cogitating|Ruminating|Pondering|Cerebrating/i.test(trimmed)) return true;

  // Claude Code help/info text that gets spammed
  if (trimmed.includes('.claude/commands/')) return true;
  if (trimmed.includes('commands that work in any project')) return true;
  if (trimmed.includes('~/.claude/')) return true;

  // Tool output and TUI prompts
  if (trimmed.includes('tool uses')) return true;
  if (trimmed.includes('ctrl+o to')) return true;
  if (trimmed.includes('ctrl+b to')) return true;
  if (trimmed.includes('Do you want to proceed')) return true;
  if (trimmed.includes('Esc to cancel')) return true;
  if (trimmed.includes('MCP tools')) return true;
  if (trimmed.startsWith('Explore(')) return true;
  if (trimmed.startsWith('Read ') && trimmed.includes(' lines')) return true;
  if (/^\+\d+ more/.test(trimmed)) return true;
  if (/^❯\s*\d+\./.test(trimmed)) return true;
  if (trimmed === '1. Yes' || trimmed === '2. Yes,' || trimmed.startsWith('3. Type here')) return true;

  // Session-specific content that's being echoed
  if (trimmed.includes('conduct a series of message-sending tests')) return true;
  if (trimmed.includes('terminal-to-chat API')) return true;
  if (trimmed.includes('Bash command')) return true;
  if (trimmed.includes('find /var/www')) return true;
  if (trimmed.includes('esc to interrupt') || trimmed.includes('to interrupt)')) return true;

  // Horizontal separators
  if (/^[\s─━═\-─━┄┅┈┉╌╍]+$/.test(trimmed)) return true;

  // TUI box structure - filter ANY line containing │ that's mostly whitespace
  if (trimmed.includes('│') && trimmed.replace(/[│\s]/g, '').length < 20) return true;

  // Box drawing lines
  if (/^[╭╮╯╰┌┐└┘├┤┬┴┼│─═║]+/.test(trimmed)) return true;

  // Try/Tip messages
  if (trimmed.startsWith('Try "') || trimmed.startsWith("Try '")) return true;
  if (trimmed.includes('Tip:') || trimmed.startsWith('⎿') || trimmed.includes('⎿')) return true;

  // Thinking/status indicators
  if (trimmed.includes('Thinking') || trimmed.includes('Ideating')) return true;
  if (trimmed.includes('Thought for')) return true;
  if (trimmed.includes('ctrl+o to show')) return true;
  if (trimmed.includes('Using tool:')) return true;
  if (trimmed.includes('for shortcuts')) return true;

  // Pass/queue spam
  if (trimmed.includes('/passes')) return true;
  if (trimmed.includes('guest passes')) return true;
  if (trimmed.includes('queued messages')) return true;
  if (trimmed.includes('that turn')) return true;

  // Prompts
  if (trimmed === '>' || trimmed === '❯' || trimmed === '$') return true;
  if (/^>\s*.+/.test(trimmed)) return true;

  // Claude Code TUI header
  if (trimmed.includes('Claude Code v') || trimmed.includes('Welcome back')) return true;
  if (trimmed.includes('Tips for') || trimmed.includes('Run /init')) return true;
  if (trimmed.includes('Recent') && (trimmed.includes('activity') || trimmed.includes('ac…'))) return true;
  if (trimmed.includes("Organization") || trimmed.includes("Opus 4")) return true;
  if (/^\*\s*[▘▝▖▗▐▛█▜▌]+\s*\*$/.test(trimmed)) return true;
  if (trimmed.includes('mdj5422@gmail.com')) return true;

  return false;
}

/**
 * Check if content should be filtered entirely from chat
 */
export function shouldFilterContent(content: string): boolean {
  // Skip Susan's briefing content entirely
  if (content.includes('LAST SESSION') ||
      content.includes('END BRIEFING') ||
      content.includes("I've gathered") ||
      content.includes('Hey Claude,') ||
      content.includes('Summary:') ||
      content.includes('RECENT CONVERSATION') ||
      content.includes('KEY KNOWLEDGE') ||
      // Multiple "You:" entries is definitely briefing echo
      (content.match(/You:/g) || []).length > 1 ||
      // Susan's knowledge tags
      content.includes('ug-fix]') ||
      content.includes('rchitecture]') ||
      content.includes('onfig]')) {
    return true;
  }

  // Skip terminal system messages
  if (content.includes('Dev Studio Terminal') ||
      content.includes('Type \'claude\'') ||
      content.includes('root@') ||
      content.includes('Connected to') ||
      content.includes('.claude/commands/') ||
      content.includes('commands that work in any project')) {
    return true;
  }

  return false;
}

/**
 * Filter terminal output for chat display
 * Returns cleaned content or empty string if should be filtered
 */
export function filterForChat(rawData: string): string {
  const cleanData = cleanAnsiCodes(rawData);
  const lines = cleanData.split('\n');
  let buffer = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines at start of buffer
    if (!trimmed && !buffer) continue;

    // Handle empty lines in middle of content
    if (!trimmed) {
      buffer += '\n';
      continue;
    }

    // Filter TUI noise
    if (shouldFilterLine(trimmed)) continue;

    // Pass everything else through
    buffer += line + '\n';
  }

  return buffer;
}
