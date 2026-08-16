import { createClient } from "redis";

const redisUrl =
	process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({
	url: redisUrl,
});

redisClient.on("error", (error) => {
	console.error("Redis Client Error:", error);
});

await redisClient.connect();

const redisPublisher = redisClient.duplicate();
const redisSubscriber = redisClient.duplicate();

redisPublisher.on("error", (error) => {
	console.error("Redis Publisher Error:", error);
});

redisSubscriber.on("error", (error) => {
	console.error("Redis Subscriber Error:", error);
});

await redisPublisher.connect();
await redisSubscriber.connect();

console.log("Redis client connected");
console.log("Redis publisher connected");
console.log("Redis subscriber connected");

export {
	redisClient,
	redisPublisher,
	redisSubscriber,
};