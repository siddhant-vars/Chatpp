import { createClient } from "redis";
import { ENV } from "./env.js";

export const redisPublisher = createClient({
	url: ENV.REDIS_URL,
});

const redisSubscriber = redisPublisher.duplicate();

/*
 * Separate Redis connection used exclusively for
 * Redis key-expiration notifications.
 *
 * A Redis connection that is subscribed to a channel
 * should not be used for normal Redis commands.
 */
const redisExpirationSubscriber =
	redisPublisher.duplicate();

redisPublisher.on("error", (error) => {
	console.error(
		"Redis publisher error:",
		error
	);
});

redisSubscriber.on("error", (error) => {
	console.error(
		"Redis subscriber error:",
		error
	);
});

redisExpirationSubscriber.on(
	"error",
	(error) => {
		console.error(
			"Redis expiration subscriber error:",
			error
		);
	}
);

const REALTIME_CHANNEL =
	"chatify:realtime";

const PRESENCE_PREFIX =
	"chatify:presence:";

const PRESENCE_TTL = 30;

/*
 * Redis keyspace notification channel.
 *
 * "__keyevent@0__:expired" means:
 *
 * Redis database 0
 *        ↓
 * key expired
 *
 * We use keyevent notifications because we want
 * to know when a presence key disappears because
 * its TTL reached zero.
 */
const REDIS_EXPIRED_CHANNEL =
	"__keyevent@0__:expired";

function getPresenceKey(
	userId,
	instanceId
) {
	return `${PRESENCE_PREFIX}${userId}:${instanceId}`;
}

/* =========================================================
 * REDIS CONNECTION
 * ========================================================= */

export async function connectRedis(
	handleRealtimeEvent
) {
	await Promise.all([
		redisPublisher.connect(),
		redisSubscriber.connect(),
		redisExpirationSubscriber.connect(),
	]);

	console.log(
		"Redis publisher connected"
	);

	console.log(
		"Redis subscriber connected"
	);

	console.log(
		"Redis expiration subscriber connected"
	);

	await redisPublisher.configSet(
		"notify-keyspace-events",
		"Ex"
	);

	/*
	 * Normal Chatify realtime events.
	 */
	await redisSubscriber.subscribe(
		REALTIME_CHANNEL,
		async (rawMessage) => {
			try {
				const parsedMessage =
					JSON.parse(rawMessage);

				await handleRealtimeEvent(
					parsedMessage
				);
			} catch (error) {
				console.error(
					"Redis realtime event error:",
					error
				);
			}
		}
	);

	console.log(
		`Redis subscribed to ${REALTIME_CHANNEL}`
	);

	/*
	 * Redis expiration events.
	 */
	await redisExpirationSubscriber.subscribe(
		REDIS_EXPIRED_CHANNEL,
		async (expiredKey) => {
			try {
				await handleExpiredKey(
					expiredKey
				);
			} catch (error) {
				console.error(
					"Redis expiration event error:",
					error
				);
			}
		}
	);

	console.log(
		`Redis subscribed to ${REDIS_EXPIRED_CHANNEL}`
	);

	/*
	 * Enable Redis keyevent notifications.
	 *
	 * "Ex" means:
	 *
	 * E = keyevent notifications
	 * x = expired events
	 */
	

	console.log(
		"Redis key expiration notifications enabled"
	);
}

/* =========================================================
 * REALTIME EVENTS
 * ========================================================= */

export async function publishRealtimeEvent(
	event,
	data
) {
	await redisPublisher.publish(
		REALTIME_CHANNEL,
		JSON.stringify({
			event,
			data,
		})
	);
}

export async function publishChatMessage(
	message
) {
	await publishRealtimeEvent(
		"newMessage",
		message.toObject
			? message.toObject()
			: message
	);
}

/* =========================================================
 * PRESENCE
 * ========================================================= */

export async function setUserOnline(
	userId,
	instanceId
) {
	const key = getPresenceKey(
		userId,
		instanceId
	);

	const wasOnline =
		await isUserOnline(userId);

	console.log(
		"SETTING PRESENCE:",
		{
			key,
			userId,
			instanceId,
			ttl: PRESENCE_TTL,
			ttlType: typeof PRESENCE_TTL,
		}
	);

	await redisPublisher.set(
		key,
		"online",
		{
			EX: PRESENCE_TTL,
		}
	);

	/*
	 * Only publish userOnline when the user
	 * was completely offline before this connection.
	 */
	if (!wasOnline) {
		await publishRealtimeEvent(
			"userOnline",
			{
				userId:
					userId.toString(),
			}
		);
	}
}

export async function refreshUserPresence(
    userId,
    instanceId
) {
    const key = getPresenceKey(
        userId,
        instanceId
    );

    const exists =
        await redisPublisher.exists(key);

    if (!exists) {
        console.warn(
            "PRESENCE KEY MISSING:",
            {
                key,
                userId,
                instanceId,
            }
        );

        return;
    }

    const refreshed =
        await redisPublisher.expire(
            key,
            PRESENCE_TTL
        );

    const ttl =
        await redisPublisher.ttl(key);

    console.log(
        "PRESENCE REFRESHED:",
        {
            key,
            userId,
            instanceId,
            refreshed,
            ttl,
        }
    );
}

export async function setUserOffline(
	userId,
	instanceId
) {
	const key = getPresenceKey(
		userId,
		instanceId
	);

	await redisPublisher.del(key);

	/*
	 * Another backend instance may still have
	 * a presence key for this user.
	 */
	const stillOnline =
		await isUserOnline(userId);

	if (!stillOnline) {
		await publishRealtimeEvent(
			"userOffline",
			{
				userId:
					userId.toString(),
			}
		);
	}
}

export async function isUserOnline(
	userId
) {
	const pattern =
		`${PRESENCE_PREFIX}${userId}:*`;

	let cursor = "0";

	do {
		const result =
			await redisPublisher.scan(
				cursor,
				{
					MATCH: pattern,
					COUNT: 100,
				}
			);

		cursor = result.cursor;

		if (result.keys.length > 0) {
			return true;
		}
	} while (cursor !== "0");

	return false;
}

export async function getOnlineUserIdsFromRedis() {
	const pattern =
		`${PRESENCE_PREFIX}*`;

	const onlineUsers =
		new Set();

	let cursor = "0";

	do {
		const result =
			await redisPublisher.scan(
				cursor,
				{
					MATCH: pattern,
					COUNT: 100,
				}
			);

		cursor = result.cursor;

		for (const key of result.keys) {
			const parts =
				key.split(":");

			/*
			 * Key format:
			 *
			 * chatify:presence:userId:instanceId
			 *
			 * parts:
			 *
			 * [0] chatify
			 * [1] presence
			 * [2] userId
			 * [3] instanceId
			 */
			if (parts.length >= 4) {
				onlineUsers.add(parts[2]);
			}
		}
	} while (cursor !== "0");

	return [...onlineUsers];
}

/* =========================================================
 * REDIS EXPIRATION HANDLING
 * ========================================================= */

const OFFLINE_LOCK_PREFIX =
	"chatify:presence:offline-lock:";

async function handleExpiredKey(
	expiredKey
) {
	/*
	 * Ignore every Redis expiration that isn't
	 * one of our Chatify presence keys.
	 */
	if (
		!expiredKey.startsWith(
			PRESENCE_PREFIX
		)
	) {
		return;
	}

	/*
	 * Example:
	 *
	 * chatify:presence:
	 * 6970fa9dcdc9bd3f66259a71:
	 * instance-1
	 */

	if (
		expiredKey.startsWith(
			OFFLINE_LOCK_PREFIX
		)
	) {
		return;
	}

	const parts =
		expiredKey.split(":");

	if (parts.length < 4) {
		return;
	}

	const userId = parts[2];

	console.log(
		"Presence key expired:",
		expiredKey
	);

	/*
	 * The key for one instance expired.
	 *
	 * But the same user might still be connected
	 * to another backend instance.
	 */
	const stillOnline =
		await isUserOnline(userId);

	if (stillOnline) {
		console.log(
			"User still online on another instance:",
			userId
		);

		return;
	}

	const lockKey = `chatify:presence:offline-lock:${userId}`;

	const lockAcquired =
		await redisPublisher.set(
			lockKey,
			"locked",
			{
				NX: true,
				EX: 5,
			}
		);

	if (!lockAcquired) {
		console.log(
			"Another instance already handled offline event:",
			userId
		);

		return;
	}

	/*
	 * No presence keys remain anywhere in Redis.
	 *
	 * Therefore the user is globally offline.
	 */
	const stillOnlineAfterLock =
		await isUserOnline(userId);

	if (stillOnlineAfterLock) {
		console.log(
			"User came back online before offline event:",
			userId
		);

		return;
	}

	console.log(
		"User globally offline after presence expiration:",
		userId
	);

	await publishRealtimeEvent(
		"userOffline",
		{
			userId: userId.toString(),
		}
	);
}

