import { createClient } from "redis";
import { ENV } from "./lib/env.js";

const redis = createClient({
	url: ENV.REDIS_URL,
});

redis.on("error", (error) => {
	console.error("Redis error:", error);
});

await redis.connect();

console.log("Redis connected");

const pattern = "chatify:presence:*";

let cursor = "0";

do {
	const result = await redis.scan(cursor, {
		MATCH: pattern,
		COUNT: 100,
	});

	cursor = result.cursor.toString();

	console.log("Keys:", result.keys);

	for (const key of result.keys) {
		const ttl = await redis.ttl(key);
		const value = await redis.get(key);

		console.log({
			key,
			value,
			ttl,
		});
	}
} while (cursor !== "0");

await redis.quit();

console.log("Redis test finished");