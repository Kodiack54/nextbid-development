// Terminal input utilities - chunked message sending

import { CHUNK_SIZE } from './constants';

/**
 * Send a message to the terminal WebSocket, chunking if necessary
 */
export function sendChunkedMessage(
  ws: WebSocket,
  message: string,
  onComplete?: () => void
): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  if (message.length > CHUNK_SIZE) {
    const chunks: string[] = [];
    for (let i = 0; i < message.length; i += CHUNK_SIZE) {
      chunks.push(message.slice(i, i + CHUNK_SIZE));
    }

    let chunkIndex = 0;
    const sendNextChunk = () => {
      if (chunkIndex < chunks.length && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: chunks[chunkIndex] }));
        chunkIndex++;
        if (chunkIndex < chunks.length) {
          setTimeout(sendNextChunk, 50);
        } else {
          // All chunks sent, now send Enter
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'input', data: '\r' }));
              onComplete?.();
            }
          }, 100);
        }
      }
    };
    sendNextChunk();
  } else {
    // Short message - send normally
    ws.send(JSON.stringify({ type: 'input', data: message }));
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: '\r' }));
        onComplete?.();
      }
    }, 50);
  }
}

/**
 * Send multiple Enter keystrokes to ensure message submission
 */
export function sendMultipleEnters(ws: WebSocket, onComplete?: () => void): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  [100, 300, 500].forEach((delay, index, arr) => {
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: '\r' }));
        if (index === arr.length - 1) {
          onComplete?.();
        }
      }
    }, delay);
  });
}

/**
 * Send arrow key escape sequence
 */
export function sendArrowKey(ws: WebSocket, direction: 'up' | 'down' | 'left' | 'right'): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const escapeSequences: Record<string, string> = {
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
  };

  ws.send(JSON.stringify({ type: 'input', data: escapeSequences[direction] }));
}

/**
 * Send Escape key
 */
export function sendEscape(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'input', data: '\x1b' }));
}

/**
 * Send Enter key
 */
export function sendEnter(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'input', data: '\r' }));
}
