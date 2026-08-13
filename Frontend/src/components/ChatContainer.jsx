import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore.js";
import { useChatStore } from "../store/useChatStore.js";
import ChatHeader from "./ChatHeader.jsx";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder.jsx";
import MessagesLoadingSkeleton from "../components/MessagesLoadingSkeleton.jsx";
import MessageInput from "./MessageInput.jsx";

function getIndiaDateKey(date) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(date));
}


function formatMessageTime(date) {
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: "Asia/Kolkata",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(date));
}


function formatDateSeparator(date) {
	const messageDate = new Date(date);

	const messageDateKey = getIndiaDateKey(messageDate);
	const todayDateKey = getIndiaDateKey(new Date());

	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);

	const yesterdayDateKey = getIndiaDateKey(yesterday);

	if (messageDateKey === todayDateKey) {
		return "Today";
	}

	if (messageDateKey === yesterdayDateKey) {
		return "Yesterday";
	}

	return new Intl.DateTimeFormat("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(messageDate);
}

function isSameDay(date1, date2) {
	return getIndiaDateKey(date1) === getIndiaDateKey(date2);
}

function ChatContainer() {
	const {
		selectedUser,
		getMessagesByUserId,
		messages,
		isMessageLoading,
		subscribeToMessage,
		unsubscribeFromMessages,
		deleteMessage,
	} = useChatStore();

	const { authUser, socket } = useAuthStore();

	const messageEndRef = useRef(null);

	useEffect(() => {
		getMessagesByUserId(selectedUser._id);
		subscribeToMessage();

		return () => unsubscribeFromMessages();
	}, [
		selectedUser,
		getMessagesByUserId,
		subscribeToMessage,
		unsubscribeFromMessages,
	]);

	useEffect(() => {
		if (!socket || !selectedUser || messages.length === 0) {
			return;
		}

		const unreadMessages = messages.filter(
			(message) =>
				message.senderId === selectedUser._id &&
				message.status !== "read"
		);

		unreadMessages.forEach((message) => {
			socket.emit("messageRead", message._id);
		});
	}, [socket, selectedUser, messages]);

	useEffect(() => {
		if (messageEndRef.current) {
			messageEndRef.current.scrollIntoView({
				behavior: "smooth",
			});
		}
	}, [messages]);

	return (
		<>
			<ChatHeader />

			<div className="flex-1 px-6 overflow-y-auto py-6">
				{messages.length > 0 && !isMessageLoading ? (
					<div className="max-w-3xl mx-auto space-y-6">
						{messages.map((msg, index) => {
	const previousMessage = messages[index - 1];

	const showDateSeparator =
		index === 0 ||
		!isSameDay(
			previousMessage.createdAt,
			msg.createdAt
		);

	const isOwnMessage =
		msg.senderId === authUser._id;

	return (
		<div key={msg._id}>
			{showDateSeparator && (
				<div className="flex items-center justify-center my-6">
					<div className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-xs">
						{formatDateSeparator(msg.createdAt)}
					</div>
				</div>
			)}

			<div
				className={`chat ${
					isOwnMessage
						? "chat-end"
						: "chat-start"
				}`}
			>
				<div
					className={`chat-bubble relative group ${
						isOwnMessage
							? "bg-cyan-600 text-white"
							: "bg-slate-800 text-slate-200"
					}`}
				>
					{msg.isDeleted ? (
						<div className="italic opacity-70">
							This message was deleted
						</div>
					) : (
						<>
							{msg.image && (
								<img
									src={msg.image}
									alt="Shared"
									className="rounded-lg h-48 object-cover"
								/>
							)}

							{msg.text && (
								<p className="mt-2">
									{msg.text}
								</p>
							)}

							{isOwnMessage && !msg.isDeleted && (
								<button
									onClick={() => deleteMessage(msg._id)}
									title="Delete message"
									aria-label="Delete message"
									className="absolute -top-3 -right-3
										w-7 h-7
										rounded-full
										bg-slate-800
										border border-slate-600
										text-slate-400
										hover:bg-red-500
										hover:border-red-500
										hover:text-white
										opacity-0
										group-hover:opacity-100
										transition-all duration-200
										flex items-center justify-center
										shadow-lg
										z-10"
								>
									<Trash2 size={14} />
								</button>
							)}
						</>
					)}

					<p className="text-xs mt-1 opacity-75 flex items-center gap-1">
						{formatMessageTime(msg.createdAt)}

						{isOwnMessage && !msg.isDeleted && (
							<span
								className={
									msg.status === "read"
										? "text-blue-300"
										: "text-white/70"
								}
							>
								{msg.status === "read"
									? "✓✓"
									: msg.status === "delivered"
									? "✓✓"
									: msg.status === "sent"
									? "✓"
									: ""}
							</span>
						)}
					</p>
				</div>
			</div>
		</div>
	);
})}

						<div ref={messageEndRef} />
					</div>
				) : isMessageLoading ? (
					<MessagesLoadingSkeleton />
				) : (
					<NoChatHistoryPlaceholder
						name={selectedUser.fullname}
					/>
				)}
			</div>

			<MessageInput />
		</>
	);
}

export default ChatContainer;