const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Used only when production has no FRONTEND_URLS / FRONTEND_URL configured.
const DEFAULT_PROD_ORIGINS = ['https://kyu-chatter-2.vercel.app'];

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

let warnedAboutProdFallback = false;

/** Trim whitespace and trailing slashes: "https://x.app/" never matches an Origin header. */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function localhostAllowed(): boolean {
  return !isProduction() || process.env.CORS_ALLOW_LOCALHOST === 'true';
}

export function getAllowedOrigins(): string[] {
  const envOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    ''
  )
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  let configured = envOrigins;

  if (isProduction() && envOrigins.length === 0) {
    if (!warnedAboutProdFallback) {
      warnedAboutProdFallback = true;
      console.warn(
        `[cors] FRONTEND_URLS is not set in production; falling back to ${DEFAULT_PROD_ORIGINS.join(', ')}`,
      );
    }
    configured = DEFAULT_PROD_ORIGINS;
  }

  return [
    ...new Set([...configured, ...(localhostAllowed() ? DEFAULT_DEV_ORIGINS : [])]),
  ];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);

  if (getAllowedOrigins().includes(normalized)) {
    return true;
  }

  if (localhostAllowed()) {
    return LOCALHOST_PATTERN.test(normalized);
  }

  return false;
}

/**
 * Disallowed origins get `allow = false` rather than an Error. Passing an Error
 * makes Express answer with a 500 that has no CORS headers, which looks like a
 * server crash in the browser console instead of a plain CORS rejection.
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, isOriginAllowed(origin));
}