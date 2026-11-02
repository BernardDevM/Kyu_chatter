
/**
 * CORS configuration utility for HTTP and WebSocket gateways.
 */

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export function getAllowedOrigins(): string[] {
  const envOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    if (envOrigins.length === 0) {
      throw new Error(
        'FRONTEND_URLS must be configured in production.',
      );
    }

    return [...new Set(envOrigins)];
  }

  return [...new Set([...envOrigins, ...DEFAULT_DEV_ORIGINS])];
}

export function isOriginAllowed(
  origin: string | undefined,
): boolean {
  if (!origin) {
    return true;
  }

  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      origin,
    );
  }

  return false;
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
}
