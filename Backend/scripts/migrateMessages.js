import mongoose from "mongoose";
import dotenv from "dotenv";
import Message from "../src/models/message.models.js";
import ConversationCounter from "../src/models/conversationCounter.models.js";
import { getConversationId } from "../src/utils/conversation.js";

dotenv.config();

async function migrateMessages() {
	try {
		console.log("Connecting to MongoDB...");

		await mongoose.connect(process.env.MONGODB_URI);

		console.log("Connected to MongoDB.");

		/*
		 * Fetch all existing messages.
		 *
		 * IMPORTANT:
		 * We sort by createdAt first so the oldest message
		 * gets the smallest sequence number.
		 *
		 * _id is used as a deterministic tie-breaker in case
		 * two messages have exactly the same createdAt.
		 */
		const messages = await Message.find({})
			.sort({
				createdAt: 1,
				_id: 1,
			})
			.lean();

		console.log(`Found ${messages.length} messages.`);

		if (messages.length === 0) {
			console.log("No messages found.");
			return;
		}

		/*
		 * Group messages by conversation.
		 */
		const conversations = new Map();

		for (const message of messages) {
			const conversationId = getConversationId(
				message.senderId,
				message.recevierId
			);

			if (!conversations.has(conversationId)) {
				conversations.set(conversationId, []);
			}

			conversations.get(conversationId).push(message);
		}

		console.log(
			`Found ${conversations.size} conversations.`
		);

		/*
		 * Prepare message updates.
		 */
		const messageOperations = [];

		/*
		 * Prepare ConversationCounter updates.
		 */
		const counterOperations = [];

		for (const [
			conversationId,
			conversationMessages,
		] of conversations) {
			console.log(
				`Migrating conversation ${conversationId}: ${conversationMessages.length} messages`
			);

			let sequenceNumber = 1;

			for (const message of conversationMessages) {
				messageOperations.push({
					updateOne: {
						filter: {
							_id: message._id,
						},
						update: {
							$set: {
								conversationId,
								sequenceNumber,
							},
						},
					},
				});

				sequenceNumber++;
			}

			/*
			 * sequenceNumber is incremented after the last message,
			 * so the last assigned sequence is sequenceNumber - 1.
			 */
			const lastSequenceNumber =
				sequenceNumber - 1;

			counterOperations.push({
				updateOne: {
					filter: {
						conversationId,
					},
					update: {
						$set: {
							sequenceNumber:
								lastSequenceNumber,
						},
					},
					upsert: true,
				},
			});
		}

		/*
		 * Update messages in batches.
		 *
		 * Batching prevents one enormous bulk operation
		 * if your database contains many messages.
		 */
		const BATCH_SIZE = 500;

		console.log("Updating messages...");

		for (
			let i = 0;
			i < messageOperations.length;
			i += BATCH_SIZE
		) {
			const batch = messageOperations.slice(
				i,
				i + BATCH_SIZE
			);

			await Message.bulkWrite(batch);

			console.log(
				`Updated ${Math.min(
					i + BATCH_SIZE,
					messageOperations.length
				)} / ${messageOperations.length} messages`
			);
		}

		console.log("Messages migrated successfully.");

		/*
		 * Update ConversationCounter documents.
		 */
		console.log("Updating conversation counters...");

		if (counterOperations.length > 0) {
			await ConversationCounter.bulkWrite(
				counterOperations
			);
		}

		console.log(
			"Conversation counters migrated successfully."
		);

		/*
		 * Verification
		 */
		const messagesWithoutSequence =
			await Message.countDocuments({
				$or: [
					{
						conversationId: {
							$exists: false,
						},
					},
					{
						sequenceNumber: {
							$exists: false,
						},
					},
				],
			});

		console.log(
			`Messages without conversationId/sequenceNumber: ${messagesWithoutSequence}`
		);

		console.log("Migration completed successfully.");
	} catch (error) {
		console.error("Migration failed:");
		console.error(error);
	} finally {
		await mongoose.disconnect();
		console.log("MongoDB connection closed.");
	}
}

migrateMessages();