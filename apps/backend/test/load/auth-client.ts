import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LoadTestConfig, LoadTestUser } from './types.js';

interface CachedUser {
  id: string;
  email: string;
  name: string;
  password: string;
  cookie: string;
  token?: string;
}

const DEFAULT_PASSWORD = 'Password123!';
const USERS_CACHE_FILE = join(process.cwd(), 'test', 'load', '.users.json');

/**
 * Paces asynchronous operations with a given sleep duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes Set-Cookie headers into a valid Cookie request header.
 */
function extractCookieHeader(response: Response): string {
  if (typeof response.headers.getSetCookie === 'function') {
    const rawCookies = response.headers.getSetCookie();
    if (rawCookies.length > 0) {
      return rawCookies.map((c) => c.split(';')[0].trim()).join('; ');
    }
  }

  const rawHeader = response.headers.get('set-cookie');
  if (rawHeader) {
    return rawHeader.split(';')[0].trim();
  }

  return '';
}

/**
 * Signs up a single user via Better Auth with retry on HTTP 429 backoff.
 */
async function signUpUser(
  config: LoadTestConfig,
  index: number,
  runId: string,
): Promise<LoadTestUser> {
  const email = `${config.prefix}+${runId}-${index}@example.com`;
  const name = `${config.prefix}-${index}`;
  const password = DEFAULT_PASSWORD;
  const signUpUrl = `${config.url.replace(/\/+$/, '')}/api/auth/sign-up/email`;

  let attempt = 0;
  const maxRetries = 6;
  let backoffMs = 800;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(signUpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: config.origin,
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.status === 429) {
        // Rate limited by Better Auth - exponential backoff
        process.stdout.write(` [429: wait ${backoffMs}ms] `);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 1.8, 8000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `Sign-up failed with status ${res.status} (${res.statusText}): ${text}`,
        );
      }

      const cookie = extractCookieHeader(res);
      const json = (await res.json()) as {
        token?: string;
        user?: { id: string };
      };

      const userId = json.user?.id;
      if (!userId) {
        throw new Error(`Sign-up succeeded but no user id returned in body: ${JSON.stringify(json)}`);
      }

      return {
        index,
        id: userId,
        email,
        name,
        password,
        cookie,
        token: json.token,
      };
    } catch (err: unknown) {
      if (attempt >= maxRetries) {
        throw err;
      }
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 8000);
    }
  }

  throw new Error(`Exceeded max sign-up retries for user ${index} (${email})`);
}

/**
 * Loads cached users from test/load/.users.json if available.
 */
async function loadCachedUsers(): Promise<CachedUser[]> {
  try {
    if (existsSync(USERS_CACHE_FILE)) {
      const data = await readFile(USERS_CACHE_FILE, 'utf-8');
      return JSON.parse(data) as CachedUser[];
    }
  } catch {
    // Ignore read or parse errors
  }
  return [];
}

/**
 * Saves users into test/load/.users.json for future reuse.
 */
async function saveCachedUsers(users: CachedUser[]): Promise<void> {
  try {
    await writeFile(USERS_CACHE_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to cache users to .users.json:', err);
  }
}

/**
 * Prepares the set of authenticated users needed for the load run.
 */
export async function setupUsers(
  config: LoadTestConfig,
  runId: string,
): Promise<LoadTestUser[]> {
  const users: LoadTestUser[] = [];
  let cached: CachedUser[] = [];

  if (config.reuse) {
    cached = await loadCachedUsers();
    console.log(`Found ${cached.length} cached users in ${USERS_CACHE_FILE}`);
  }

  const needed = config.users;
  const reusedCount = Math.min(cached.length, needed);

  for (let i = 0; i < reusedCount; i++) {
    const c = cached[i];
    users.push({
      index: i,
      id: c.id,
      email: c.email,
      name: c.name,
      password: c.password,
      cookie: c.cookie,
      token: c.token,
    });
  }

  if (users.length < needed) {
    const toCreate = needed - users.length;
    console.log(
      `Creating ${toCreate} new users via Better Auth on ${config.url}...`,
    );

    for (let i = users.length; i < needed; i++) {
      const user = await signUpUser(config, i, runId);
      users.push(user);
      process.stdout.write(`\r  Created users: ${users.length}/${needed}`);

      // Small pacing delay to avoid tight loop burst
      await sleep(60);
    }
    console.log();

    if (config.reuse) {
      const toCache: CachedUser[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        password: u.password,
        cookie: u.cookie,
        token: u.token,
      }));
      await saveCachedUsers(toCache);
    }
  }

  console.log(`Successfully prepared ${users.length} authenticated users.`);
  return users;
}
