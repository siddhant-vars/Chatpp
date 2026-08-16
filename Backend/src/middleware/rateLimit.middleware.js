import { redisPublisher } from "../lib/redisPubSub.js";

function normalizeIp(ip) {
	if (ip === "::1") {
		return "127.0.0.1";
	}

	if (ip.startsWith("::ffff:")) {
		return ip.substring(7);
	}

	return ip;
}

/*
 * Distributed Redis rate limiter.
 *
 * IMPORTANT:
 * We reuse the already-connected redisPublisher
 * from redisPubSub.js.
 *
 * Therefore we do NOT call redis.connect()
 * inside the middleware.
 */
export function rateLimit({
	windowSeconds = 60,
	maxRequests = 100,
	keyPrefix = "general",
	keyGenerator,
}) {
	return async (req, res, next) => {
		try {
			/*
			 * Generate the identifier.
			 *
			 * For authenticated routes this can be
			 * req.user._id.
			 *
			 * For public routes it can be
			 * req.ip.
			 */
			const identifier = keyGenerator
	? keyGenerator(req)
	: normalizeIp(req.ip);

			const key =
				`chatify:rate-limit:${keyPrefix}:${identifier}`;

            console.log("RATE LIMIT:", {
                key,
                identifier,
                instance: process.env.INSTANCE_ID,
            });

			/*
			 * Atomically increment the counter.
			 */
			const count =
				await redisPublisher.incr(key);

			/*
			 * Only the first request sets
			 * the expiration.
			 */
			if (count === 1) {
				await redisPublisher.expire(
					key,
					windowSeconds
				);
			}

			const ttl =
				await redisPublisher.ttl(key);

			/*
			 * Rate-limit response headers.
			 */
			res.setHeader(
				"X-RateLimit-Limit",
				maxRequests
			);

			res.setHeader(
				"X-RateLimit-Remaining",
				Math.max(
					0,
					maxRequests - count
				)
			);

			res.setHeader(
				"X-RateLimit-Reset",
				Math.max(0, ttl)
			);

			/*
			 * Limit exceeded.
			 */
			if (count > maxRequests) {
				return res.status(429).json({
					success: false,
					message:
						"Too many requests. Please try again later.",
					retryAfter: Math.max(
						0,
						ttl
					),
				});
			}

			next();
		} catch (error) {
			console.error(
				"Rate limiter error:",
				error
			);

			/*
			 * Fail open.
			 *
			 * If Redis temporarily fails,
			 * don't break the entire API.
			 */
			next();
		}
	};
}
