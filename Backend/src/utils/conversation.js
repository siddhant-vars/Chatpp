export function getConversationId(userId1, userId2) {
	return [userId1.toString(), userId2.toString()]
		.sort()
		.join("_");
}