import Message from "../models/message.models.js";
import User from "../models/user.models.js";
import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import cloudinary from "../lib/cloudinary.js";

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
    })
    return res
    .status(200)
    .json(new ApiResponse(200,messages,"messages fetched successfully"))
})

export const sendMessage = asynchandler( async(req, res) => {
    const senderId = req.user._id;
    const {id:recevierId} = req.params;
    const {text, image} = req.body;

    if(!text || !image) {
        throw new ApiError(400, "images or text are required");
    }
    if(senderId.equal(recevierId)) {
        throw new ApiError(400,"Cannot send message to yourself")
    }
    const receiverExists = await User.exists({_id: recevierId})
    if(!receiverExists) {
        throw new ApiError(404, "Receiver not found")
    }
    let imageUrl;
    if(image) {
        const imageResponse = await cloudinary.uploader.upload(image);
        imageUrl = imageResponse.secure_url;
    }
    const newMessage = await Message.create({
        senderId,
        recevierId,
        text,
        image: imageUrl
    })
    if(!newMessage) {
        throw new ApiError(500,"Message creation failed")
    }

    res
    .status(201)
    .json(new ApiResponse(201,newMessage,"Message created successfully"))
})

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