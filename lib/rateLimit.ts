import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { recordLog } from "./logging";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimit = {
  email: {
    system: new Ratelimit({
      redis,
      analytics: true,
      prefix: "ratelimit:email:system",
      limiter: Ratelimit.slidingWindow(100, "30m"),
    }),
    individual: new Ratelimit({
      redis,
      prefix: "ratelimit:email:individual",
      limiter: Ratelimit.slidingWindow(5, "20s"),
    }),
  },
  auth: {
    login: {
      global: new Ratelimit({
        redis,
        analytics: true,
        prefix: "ratelimit:auth:login:global",
        limiter: Ratelimit.slidingWindow(100, "20s"),
      }),
      individual: new Ratelimit({
        redis,
        analytics: true,
        prefix: "ratelimit:auth:login:individual",
        limiter: Ratelimit.slidingWindow(5, "10s"),
      }),
    },
    signUp: {
      global: new Ratelimit({
        redis,
        analytics: true,
        prefix: "ratelimit:auth:signUp:global",
        limiter: Ratelimit.slidingWindow(100, "20s"),
      }),
      individual: new Ratelimit({
        redis,
        analytics: true,
        prefix: "ratelimit:auth:signUp:individual",
        limiter: Ratelimit.slidingWindow(5, "10s"),
      }),
    },
    verify: {
      global: new Ratelimit({
        redis,
        analytics: true,
        prefix: "ratelimit:auth:verify:global",
        limiter: Ratelimit.slidingWindow(100, "20s"),
      }),
      individual: new Ratelimit({
        redis,
        analytics: true,
        prefix: "ratelimit:auth:verify:individual",
        limiter: Ratelimit.slidingWindow(5, "10s"),
      }),
    },
  },
};

type rateLimiters = typeof ratelimit.auth.login;

interface rateLimitCheckResponse {
  success: boolean;
  type: "individual" | "global";
  limit: Number;
  remaining: Number;
}

// TODO: to define user headers
/**
 * Function to check the rate limit for a server action.
 *
 * @param {rateLimiters} rateLimiters - Object containing rate limiters for global and individual limits.
 * @param {string} serverAction - The server action being checked for rate limiting.
 * @param {string} system - The system where the rate limit check is happening.
 * @param {string} userIP - The IP address of the user making the request.
 * @return {Promise<rateLimitCheckResponse>} A promise that resolves to the rate limit check response.
 */
export async function checkRatelimitServerAction(
  rateLimiters: rateLimiters,
  serverAction: string,
  system: string,
  userIP: string,
): Promise<rateLimitCheckResponse> {
  const globalIdentifier = `${serverAction}Global`;
  const promises = [];
  promises.push(rateLimiters.global.limit(globalIdentifier));
  promises.push(rateLimiters.individual.limit(userIP));
  const [globalRateLimitRes, individualRateLimitRes] = await Promise.all(
    promises,
  );
  if (!globalRateLimitRes.success) {
    await recordLog({
      type: "critical",
      system: system,
      topic: "security",
      message:
        `Global rate limit reached on ${serverAction} server action, reached ${globalRateLimitRes.limit} requests`,
      daysUntilExpire: 14,
    });
    return {
      success: false,
      type: "global",
      limit: globalRateLimitRes.limit,
      remaining: globalRateLimitRes.remaining,
    };
  }
  if (!individualRateLimitRes.success) {
    await recordLog({
      type: "info",
      system: system,
      topic: "security",
      message:
        `individual rate limit reached on ${serverAction} server action, reached ${individualRateLimitRes.limit} requests for user with ipAddress: ${userIP}`,
      daysUntilExpire: 14,
    });
    return {
      success: false,
      type: "individual",
      limit: individualRateLimitRes.limit,
      remaining: individualRateLimitRes.remaining,
    };
  }
  return {
    success: true,
    type: "individual",
    limit: individualRateLimitRes.limit,
    remaining: individualRateLimitRes.remaining,
  };
}
