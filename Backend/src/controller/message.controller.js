import Message from "../models/message.models.js";
import User from "../models/user.models.js";
import ConversationCounter from "../models/conversationCounter.models.js";
import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import cloudinary from "../lib/cloudinary.js";
import { getConversationId } from "../utils/conversation.js";
import mongoose from "mongoose";
import { publishChatMessage, publishRealtimeEvent } from "../lib/redisPubSub.js";


export const getAllContacts = asynchandler( async(req, res) => {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({_id: {$ne: loggedInUserId}}).select("-password")
    return res
    .status(200)
    .json( new ApiResponse(200, filteredUsers, "All contacts fetched successfully"))
})

export const getMessagesbyUserId = asynchandler(async (req, res) => {
	const myId = req.user._id;
	const { id: userToChatId } = req.params;

	const conversationId = getConversationId(
		myId,
		userToChatId
	);

	const requestedLimit = Number(req.query.limit) || 30;

	const limit = Math.min(
		Math.max(requestedLimit, 1),
		50
	);

	const before = req.query.before
		? Number(req.query.before)
		: null;

	if (
		before !== null &&
		(!Number.isInteger(before) || before <= 0)
	) {
		throw new ApiError(
			400,
			"Invalid cursor"
		);
	}

	const query = {
		conversationId,
	};

	if (before !== null) {
		query.sequenceNumber = {
			$lt: before,
		};
	}

	const messages = await Message.find(query)
		.sort({
			sequenceNumber: -1,
		})
		.limit(limit + 1);

	const hasMore = messages.length > limit;

	if (hasMore) {
		messages.pop();
	}

	messages.reverse();

	const nextCursor = hasMore
		? messages[0]?.sequenceNumber
		: null;

	return res
		.status(200)
		.json(
			new ApiResponse(
				200,
				{
					messages,
					nextCursor,
					hasMore,
				},
				"Messages fetched successfully"
			)
		);
});

export const sendMessage = asynchandler(async (req, res) => {
	const senderId = req.user._id;
	const { id: recevierId } = req.params;
	const { text, image, clientMessageId } = req.body;

	if (!clientMessageId) {
		throw new ApiError(
			400,
			"clientMessageId is required"
		);
	}

	if (!text && !image) {
		throw new ApiError(
			400,
			"Images or text are required"
		);
	}

	if (senderId.equals(recevierId)) {
		throw new ApiError(
			400,
			"Cannot send message to yourself"
		);
	}

	const receiverExists = await User.exists({
		_id: recevierId,
	});

	if (!receiverExists) {
		throw new ApiError(
			404,
			"Receiver not found"
		);
	}

	/*
	 * Check for an existing message first.
	 *
	 * This handles normal retries of the same
	 * clientMessageId.
	 */
	const existingMessage = await Message.findOne({
		senderId,
		clientMessageId,
	});

	if (existingMessage) {
		return res
			.status(200)
			.json(
				new ApiResponse(
					200,
					existingMessage,
					"Message already exists"
				)
			);
	}

	let imageUrl;

	if (image) {
		const imageResponse =
			await cloudinary.uploader.upload(image);

		imageUrl = imageResponse.secure_url;
	}

	const conversationId = getConversationId(
		senderId,
		recevierId
	);

	let newMessage;

	const session = await mongoose.startSession();

	try {
		await session.withTransaction(async () => {
			/*
			 * Atomically increment the counter.
			 *
			 * Example:
			 *
			 * 100 → 101
			 * 101 → 102
			 * 102 → 103
			 */
			const counter =
				await ConversationCounter.findOneAndUpdate(
					{ conversationId },
					{
						$inc: {
							sequenceNumber: 1,
						},
					},
					{
						new: true,
						upsert: true,
						session,
					}
				);

			const sequenceNumber =
				counter.sequenceNumber;

			const messages =
				await Message.create(
					[
						{
							senderId,
							recevierId,
							conversationId,
							sequenceNumber,
							clientMessageId,
							text,
							image: imageUrl,
							status: "sent",
						},
					],
					{ session }
				);

			newMessage = messages[0];
		});
	} catch (error) {
		/*
		 * Another request could have created the same
		 * clientMessageId at exactly the same time.
		 *
		 * The unique index protects us from duplicates.
		 */
		if (error.code === 11000) {
			const existingMessage =
				await Message.findOne({
					senderId,
					clientMessageId,
				});

			if (existingMessage) {
				return res
					.status(200)
					.json(
						new ApiResponse(
							200,
							existingMessage,
							"Message already exists"
						)
					);
			}
		}

		throw error;
	} finally {
		await session.endSession();
	}
	/*
	 * Send the message to all active sockets
	 * belonging to the receiver.
	 */
	await publishChatMessage(newMessage);

	return res
		.status(201)
		.json(
			new ApiResponse(
				201,
				newMessage,
				"Message created successfully"
			)
		);
});

export const getAllChats = asynchandler(async(req, res) => {
    const loggedInUserId = req.user._id;

    const messages = await Message.find({
        $or: [{senderId: loggedInUserId},{recevierId:loggedInUserId}],
    })

    const chatPartnersIds = [...new Set(messages.map((msg) => msg.senderId.toString() === loggedInUserId.toString()? msg.recevierId.toString(): msg.senderId.toString()))]

    const chatPartners = await User.find({_id: {$in: chatPartnersIds}}).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,chatPartners,"chartpartners fetched successfully"))
})

export const deleteMessage = asynchandler(async (req, res) => {
	const userId = req.user._id;
	const { messageId } = req.params;

	const message = await Message.findById(messageId);

	if (!message) {
		throw new ApiError(404, "Message not found");
	}

	// Only the sender can delete the message for everyone
	if (message.senderId.toString() !== userId.toString()) {
		throw new ApiError(
			403,
			"You can only delete your own messages"
		);
	}

	// Prevent deleting an already deleted message
	if (message.isDeleted) {
		return res.status(200).json(
			new ApiResponse(
				200,
				message,
				"Message already deleted"
			)
		);
	}

	message.isDeleted = true;
	message.deletedAt = new Date();


	await message.save();

	// Notify the receiver in real time
	await publishRealtimeEvent(
		"messageDeleted",
		{
			messageId: message._id.toString(),
			recevierId: message.recevierId.toString(),
			deletedAt: message.deletedAt,
		}
	);

	return res.status(200).json(
		new ApiResponse(
			200,
			message,
			"Message deleted successfully"
		)
	);
});

export const getMessageBySequence = asynchandler(
	async (req, res) => {
		const myId = req.user._id;
		const { id: userToChatId, sequenceNumber } = req.params;

		const sequence = Number(sequenceNumber);

		if (!Number.isInteger(sequence) || sequence <= 0) {
			throw new ApiError(
				400,
				"Invalid sequence number"
			);
		}

		const conversationId = getConversationId(
			myId,
			userToChatId
		);

		const message = await Message.findOne({
			conversationId,
			sequenceNumber: sequence,
		});

		if (!message) {
			throw new ApiError(
				404,
				"Message does not exist"
			);
		}

		return res.status(200).json(
			new ApiResponse(
				200,
				message,
				"Message fetched successfully"
			)
		);
	}
);