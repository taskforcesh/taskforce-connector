export interface RateLimitStatus {
  ttl: number;
  globalRateLimit: { max: number; duration: number } | null;
  /**
   * Measured state of the current limiter window (jobs started since the window
   * began and time until it resets). Not the configured limit, as worker limiter
   * options are not stored in Redis.
   */
  window: { count: number; ttl: number } | null;
}

/**
 * Returns the rate limit status of a BullMQ queue, or null if the installed
 * BullMQ version does not support it.
 */
export async function getRateLimitStatus(
  queue: any
): Promise<RateLimitStatus | null> {
  // getGlobalRateLimit is only available in BullMQ versions where
  // getRateLimitTtl also accepts the maxJobs argument, which we rely on.
  if (
    typeof queue?.getRateLimitTtl !== "function" ||
    typeof queue?.getGlobalRateLimit !== "function"
  ) {
    return null;
  }

  // All reads are issued together so the status costs a single Redis round trip.
  const [globalRateLimit, globalTtl, manualTtl, window] = await Promise.all([
    queue.getGlobalRateLimit(),
    queue.getRateLimitTtl(undefined),
    queue.getRateLimitTtl(Number.MAX_SAFE_INTEGER),
    getLimiterWindow(queue),
  ]);

  // With a global rate limit, BullMQ uses its "max" to decide if the queue is limited.
  // Otherwise the limiter key may just be a worker-side counter that has not reached
  // its max, so we only consider manual rate limits (Queue/Worker#rateLimit), which
  // set the counter to Number.MAX_SAFE_INTEGER.
  const ttl: number = globalRateLimit ? globalTtl : manualTtl;

  return { ttl, globalRateLimit: globalRateLimit || null, window };
}

/**
 * Job counts, including the rate limit status in the "rateLimit" field when
 * requested, so that the dashboard gets both with a single message.
 */
export async function getJobCounts(queue: any, data: { rateLimit?: boolean }) {
  if (!data?.rateLimit) {
    return queue.getJobCounts();
  }

  const [counts, rateLimit] = await Promise.all([
    queue.getJobCounts(),
    // The rate limit status is best effort, it must not break the counts.
    getRateLimitStatus(queue).catch((): null => null),
  ]);
  return { ...counts, rateLimit };
}

async function getLimiterWindow(
  queue: any
): Promise<{ count: number; ttl: number } | null> {
  try {
    // getRateLimitTtl(1) returns the limiter key PTTL as long as the counter is >= 1.
    const [count, ttl] = await Promise.all([
      getLimiterCount(queue),
      queue.getRateLimitTtl(1) as Promise<number>,
    ]);
    // Manual rate limits set the counter to MAX_SAFE_INTEGER, it is not a job count.
    if (!count || count >= Number.MAX_SAFE_INTEGER) {
      return null;
    }
    return ttl > 0 ? { count, ttl } : null;
  } catch {
    return null;
  }
}

async function getLimiterCount(queue: any): Promise<number | null> {
  const key: string | undefined = queue?.keys?.limiter;
  if (!key) {
    return null;
  }

  // BullMQ >= 6 exposes the Redis client through its backend (absent for Postgres).
  const client = await (typeof queue.getBackend === "function"
    ? queue.getBackend()?.client
    : queue.client);
  if (typeof client?.get !== "function") {
    return null;
  }

  const raw = await client.get(key);
  const count = Number(raw);
  return raw !== null && Number.isFinite(count) ? count : null;
}
