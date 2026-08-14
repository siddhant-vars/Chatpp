import mongoose from "mongoose";

const conversationCounterSchema = new mongoose.Schema(
	{
		conversationId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},

		sequenceNumber: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

const ConversationCounter = mongoose.model(
	"ConversationCounter",
	conversationCounterSchema
);

export default ConversationCounter;