import Message from "../models/message.models.js";
import User from "../models/user.models.js";
import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import cloudinary from "../lib/cloudinary.js";
import {getReceiverSocketIds,io} from "../lib/socket.js"


export const getAllContacts = asynchandler( async(req, res) => {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({_id: {$ne: loggedInUserId}}).select("-password")
    return res
    .status(200)
    .json( new ApiResponse(200, filteredUsers, "All contacts fetched successfully"))
})

export const getMessagesbyUserId = asynchandler(async(req, res) => {
    const myId = req.user._id;
    const {id: userToChatId} = req.params;
    const messages = await Message.find({
        $or: [
            {senderId: myId, recevierId: userToChatId},
            {senderId: userToChatId, recevierId: myId}
        ]
    }).sort({createdAt : 1})

    return res
    .status(200)
    .json(new ApiResponse(200,messages,"messages fetched successfully"))
})

export const sendMessage = asynchandler(async (req, res) => {
	const senderId = req.user._id;
	const { id: recevierId } = req.params;
	const { text, image, clientMessageId } = req.body;

	if (!clientMessageId) {
		throw new ApiError(400, "clientMessageId is required");
	}

	if (!text && !image) {
		throw new ApiError(400, "Images or text are required");
	}

	if (senderId.equals(recevierId)) {
		throw new ApiError(400, "Cannot send message to yourself");
	}

	const receiverExists = await User.exists({
		_id: recevierId,
	});

	if (!receiverExists) {
		throw new ApiError(404, "Receiver not found");
	}

	/*
	 * Check whether this message was already created.
	 *
	 * This makes the API idempotent.
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
		const imageResponse = await cloudinary.uploader.upload(image);
		imageUrl = imageResponse.secure_url;
	}

	const newMessage = await Message.create({
		senderId,
		recevierId,
		clientMessageId,
		text,
		image: imageUrl,
		status: "sent",
	});

	if (!newMessage) {
		throw new ApiError(500, "Message creation failed");
	}

	const receiverSocketIds = getReceiverSocketIds(recevierId.toString());

	for (const socketId of receiverSocketIds) {
        io.to(socketId).emit(
            "newMessage",
            newMessage
        );
    }

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
	const receiverSocketId = getReceiverSocketIds(
		message.recevierId.toString()
	);

	if (receiverSocketId) {
		io.to(receiverSocketId).emit("messageDeleted", {
			messageId: message._id.toString(),
		});
	}

	return res.status(200).json(
		new ApiResponse(
			200,
			message,
			"Message deleted successfully"
		)
	);
});