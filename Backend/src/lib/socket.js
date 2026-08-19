import {
	Server,
} from "socket.io";

import http from "http";
import express from "express";

import { ENV } from "./env.js";

import {
	socketAuthMiddleware,
} from "../middleware/socket.auth.middleware.js";

import Message from "../models/message.models.js";

import {
	publishRealtimeEvent,
	setUserOnline,
	refreshUserPresence,
	setUserOffline,
	getOnlineUserIdsFromRedis
} from "./redisPubSub.js";

import {
	addUserSocket,
	removeUserSocket,
	getReceiverSocketIds,
} from "./socketRegistry.js";

const app = express();

const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
];

if (ENV.FRONTEND_URL) {
    allowedOrigins.push(ENV.FRONTEND_URL);
}

const io = new Server(server, {
	pingInterval: 10000,   // ping every 10s
	pingTimeout: 5000, 
	cors: {
		origin:allowedOrigins,
		credentials: true,
	},
});

io.use(socketAuthMiddleware);

io.on("connection", async (socket) => {
	

	const userId =
		socket.userId.toString();

	const instanceId =
		ENV.INSTANCE_ID;

	

	/*
	 * Add this socket to the local
	 * backend instance registry.
	 */
	const socketCount = addUserSocket(
		userId,
		socket.id
	);

	console.log(
	`[SOCKET CONNECT] user=${socket.user.fullname} ` +
	`userId=${userId} ` +
	`socketId=${socket.id} ` +
	`instance=${instanceId} ` +
	`localSocketCount=${socketCount}`
);

	/*
	 * Only the first socket means the user
	 * became online on this instance.
	 */
	if (socketCount === 1) {
		await setUserOnline(
			userId,
			ENV.INSTANCE_ID
		);
	}

	/*
	 * Broadcast local online users.
	 */
	const onlineUserIds = await getOnlineUserIdsFromRedis();

	console.log(
		`[ONLINE USERS] instance=${instanceId} ` +
		`count=${onlineUserIds.length} ` +
		`users=${onlineUserIds.join(",")}`
	);

	socket.emit(
		"getOnlineUsers",
		onlineUserIds
	);

	// io.emit(
	// 	"getOnlineUsers",
	// 	onlineUserIds
	// );

	/*
	 * Refresh presence periodically.
	 *
	 * Redis key has a 30-second TTL.
	 */
	const presenceInterval = setInterval(
    async () => {

        try {
            await refreshUserPresence(
                userId,
                instanceId
            );
        } catch (error) {
            console.error(
                `[PRESENCE REFRESH FAILED] ` +
                `user=${userId} ` +
                `instance=${instanceId}`,
                error
            );
        }
    },
    10000
);

	socket.on(
		"messageDelivered",
		async (messageId) => {
			try {
				const message =
					await Message.findById(
						messageId
					);

				if (!message) {
					return;
				}

				/*
				 * Only the receiver can
				 * acknowledge delivery.
				 */
				if (
					message.recevierId.toString() !==
					userId
				) {
					return;
				}

				if (
					message.status ===
					"delivered"
				) {
					return;
				}

				message.status =
					"delivered";

				message.deliveredAt =
					new Date();

				await message.save();

				await publishRealtimeEvent(
					"messageDelivered",
					{
						messageId:
							message._id.toString(),

						senderId:
							message.senderId.toString(),

						deliveredAt:
							message.deliveredAt,
					}
				);
			} catch (error) {
				console.error(
					"Error handling message delivery:",
					error
				);
			}
		}
	);

	socket.on(
		"messageRead",
		async (messageId) => {
			try {
				const message =
					await Message.findById(
						messageId
					);

				if (!message) {
					return;
				}

				/*
				 * Only the receiver can mark
				 * the message as read.
				 */
				if (
					message.recevierId.toString() !==
					userId
				) {
					return;
				}

				if (
					message.status === "read"
				) {
					return;
				}

				message.status = "read";
				message.readAt = new Date();

				await message.save();

				await publishRealtimeEvent(
					"messageRead",
					{
						messageId:
							message._id.toString(),

						senderId:
							message.senderId.toString(),

						readAt:
							message.readAt,
					}
				);
			} catch (error) {
				console.error(
					"Error handling message read:",
					error
				);
			}
		}
	);

	socket.on(
		"disconnect",
		async (reason) => {
			console.log(
            `[SOCKET DISCONNECT] ` +
            `user=${socket.user.fullname} ` +
            `userId=${userId} ` +
            `socketId=${socket.id} ` +
            `instance=${instanceId} ` +
            `reason=${reason}`
        );

			clearInterval(
				presenceInterval
			);

			/*
			 * Remove only this socket.
			 */
			const remainingSockets =
				removeUserSocket(
					userId,
					socket.id
				);

			/*
			 * User is offline on this
			 * backend instance only when
			 * no local sockets remain.
			 */
			if (remainingSockets === 0) {
				await setUserOffline(
					userId,
					instanceId
				);
			}
		}
	);
});

export {
	io,
	server,
	app,
};