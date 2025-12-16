// Terminal configuration constants

// AI Team worker URLs (Development droplet)
export const DEV_DROPLET = '161.35.229.220';
export const CHAD_WS_URL = `ws://${DEV_DROPLET}:5401/ws`; // WebSocket path for Chad
export const SUSAN_URL = `http://${DEV_DROPLET}:5403`;

// Chunk size for long messages
export const CHUNK_SIZE = 1000;

// Debounce delay for chat message output (ms)
export const CHAT_DEBOUNCE_MS = 1500;

// Minimum content length for chat messages
export const MIN_CONTENT_LENGTH = 20;

// Dedup cooldown (ms) - should match CHAT_DEBOUNCE_MS
export const DEDUP_COOLDOWN_MS = 1500;

// Fallback timer for Susan briefing (ms) - needs to be long enough for Claude to fully load
export const BRIEFING_FALLBACK_MS = 25000;

// Delay before showing messages after briefing (ms)
export const POST_BRIEFING_DELAY_MS = 5000;
