import express from "express";

import {
	getAllContacts,
	getMessagesbyUserId,
	getMessageBySequence,
	sendMessage,
	getAllChats,
	deleteMessage,
} from "../controller/message.controller.js";

import {
	protectRoute,
} from "../middleware/auth.middleware.js";

import {
	arcjetProtection,
} from "../middleware/arcjet.middleware.js";

import {
	rateLimit,
} from "../middleware/rateLimit.middleware.js";

const router = express.Router();

/*
 * Message API rate limit:
 *
 * 30 requests per minute
 * per authenticated user.
 *
 * Because userId is used as the key,
 * the limit is shared across all
 * backend instances.
 */
const messageRateLimit = rateLimit({
	windowSeconds: 60,
	maxRequests: 30,
	keyPrefix: "messages",

	keyGenerator: (req) =>
		req.user._id.toString(),
});

/*
 * Authentication must happen before
 * the rate limiter because the limiter
 * uses req.user._id.
 */
router.use(
	arcjetProtection,
	protectRoute
);

router.get(
	"/contacts",
	messageRateLimit,
	getAllContacts
);

router.get(
	"/chats",
	messageRateLimit,
	getAllChats
);

router.get(
	"/:id/sequence/:sequenceNumber",
	messageRateLimit,
	getMessageBySequence
);

router.get(
	"/:id",
	messageRateLimit,
	getMessagesbyUserId
);

router.post(
	"/send/:id",
	messageRateLimit,
	sendMessage
);

router.delete(
	"/:messageId",
	messageRateLimit,
	deleteMessage
);

export default router;
