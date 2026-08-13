import {Server} from "socket.io"
import http from "http"
import express from "express"
import { ENV } from "./env.js"
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js"
import Message from "../models/message.models.js";

const app = express()

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: ENV.NODE_ENV === "production" ? true : ENV.CLIENT_URL,
        credentials: true,
    },
});

io.use(socketAuthMiddleware)

export function getReceiverSocketIds(userId) {
	const sockets = userSocketMap.get(userId);

	if (!sockets) {
		return [];
	}

	return [...sockets];
}

const userSocketMap = new Map()

io.on("connection", (socket) => {
	console.log(
		"A user connected:",
		socket.user.fullname
	);

	const userId = socket.userId.toString();

	/*
	 * One user can have multiple connections.
	 *
	 * Example:
	 * Chrome + Firefox + Mobile
	 */
	if (!userSocketMap.has(userId)) {
		userSocketMap.set(userId, new Set());
	}

	userSocketMap.get(userId).add(socket.id);

	io.emit(
		"getOnlineUsers",
		[...userSocketMap.keys()]
	);

	socket.on(
		"messageDelivered",
		async (messageId) => {
			try {
				const message =
					await Message.findById(messageId);

				if (!message) {
					return;
				}

				/*
				 * Only the receiver can acknowledge
				 * the message.
				 */
				if (
					message.recevierId.toString() !==
					userId
				) {
					return;
				}

				if (message.status === "delivered") {
					return;
				}

				message.status = "delivered";
				message.deliveredAt = new Date();

				await message.save();

				const senderSocketIds =
					getReceiverSocketIds(
						message.senderId.toString()
					);

				for (const socketId of senderSocketIds) {
					io.to(socketId).emit(
						"messageDelivered",
						{
							messageId: message._id,
							deliveredAt:
								message.deliveredAt,
						}
					);
				}
			} catch (error) {
				console.error(
					"Error handling message delivery:",
					error
				);
			}
		}
	);

	socket.on("messageRead", async (messageId) => {
		try {
			const message = await Message.findById(messageId);

			if (!message) {
				return;
			}

			// Only the receiver can mark a message as read.
			if (message.recevierId.toString() !== userId) {
				return;
			}

			// Already read.
			if (message.status === "read") {
				return;
			}

			message.status = "read";
			message.readAt = new Date();

			await message.save();

			// Notify the sender.
			const senderSocketIds = getReceiverSocketIds(
				message.senderId.toString()
			);

			for (const socketId of senderSocketIds) {
				io.to(socketId).emit("messageRead", {
					messageId: message._id,
					readAt: message.readAt,
				});
			}
		} catch (error) {
			console.error(
				"Error handling message read:",
				error
			);
		}
	});

	socket.on("disconnect", () => {
		console.log(
			"A user disconnected:",
			socket.user.fullname
		);

		const sockets =
			userSocketMap.get(userId);

		if (sockets) {
			sockets.delete(socket.id);

			if (sockets.size === 0) {
				userSocketMap.delete(userId);
			}
		}

		io.emit(
			"getOnlineUsers",
			[...userSocketMap.keys()]
		);
	});
});

export {io,server,app}