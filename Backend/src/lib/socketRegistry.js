const userSocketMap = new Map();

export function addUserSocket(
	userId,
	socketId
) {
	if (!userSocketMap.has(userId)) {
		userSocketMap.set(
			userId,
			new Set()
		);
	}

	const sockets =
		userSocketMap.get(userId);

	sockets.add(socketId);

	return sockets.size;
}

export function removeUserSocket(
	userId,
	socketId
) {
	const sockets =
		userSocketMap.get(userId);

	if (!sockets) {
		return 0;
	}

	sockets.delete(socketId);

	if (sockets.size === 0) {
		userSocketMap.delete(userId);
		return 0;
	}

	return sockets.size;
}

export function getReceiverSocketIds(userId) {
	const sockets =
		userSocketMap.get(userId);

	if (!sockets) {
		return [];
	}

	return [...sockets];
}

export function getOnlineUserIds() {
	return [...userSocketMap.keys()];
}

export function getAllSocketIds() {
	const socketIds = [];

	for (const sockets of userSocketMap.values()) {
		for (const socketId of sockets) {
			socketIds.push(socketId);
		}
	}

	return socketIds;
}