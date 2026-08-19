import {create} from "zustand"
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast"
import {useAuthStore} from "./useAuthStore.js"

export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: "chats",
    selectedUser: null,
    isUserLoading: false,
    isMessageLoading: false,
    isSoundEnabled: localStorage.getItem("isSoundEnabled") === "true",

    toggleSound: () => {
        localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
        set({isSoundEnabled: !get().isSoundEnabled});
    },

    setActiveTab: (tab) => set({ activeTab: tab}),
    setSelectedUser: (selectedUser) => set({selectedUser}),
    getAllContacts: async () => {
        set({isUserLoading: true})
        try {
            const res = await axiosInstance.get("/messages/contacts")
            set({allContacts: res.data.data || res.data})
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Contacts fetching failed"
            )
        } finally {
            set({isUserLoading: false})
        }
    },

    getMyChatPartners : async () => {
        set({isUserLoading: true})
        try {
            const res = await axiosInstance.get("/messages/chats")
            set({chats: res.data.data || res.data})
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "chats fetching failed"
            )
        } finally {
            set({isUserLoading: false})
        }
    },

    getMessagesByUserId: async (userId) => {
        set({isMessageLoading: true})
        try {
            const res = await axiosInstance.get(`/messages/${userId}`)
            const messages = res.data.data?.messages || [];

            messages.sort(
                (a, b) =>
                    a.sequenceNumber -
                    b.sequenceNumber
            );

            set({ messages });
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Messages fetching failed"
            )
        } finally {
            set({isMessageLoading: false})
        }
    },

    sendMessages: async (messageData) => {
    const { selectedUser } = get();
    const { authUser } = useAuthStore.getState();

    if (!selectedUser || !authUser) {
        return;
    }

    const clientMessageId = crypto.randomUUID();

    const optimisticMessage = {
        _id: clientMessageId,
        clientMessageId,
        senderId: authUser._id,
        recevierId: selectedUser._id,
        text: messageData.text,
        image: messageData.image,
        createdAt: new Date().toISOString(),
        status: "sending",
        isOptimistic: true,
    };

    set((state) => ({
        messages: [...state.messages, optimisticMessage],
    }));

    /*
     * Send the message using the SAME clientMessageId.
     *
     * This is important because if the request succeeds on
     * the backend but the HTTP response is lost, retrying with
     * the same clientMessageId prevents duplicate messages.
     */
    const sendRequest = async () => {
        return axiosInstance.post(
            `/messages/send/${selectedUser._id}`,
            {
                ...messageData,
                clientMessageId,
            }
        );
    };

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            set((state) => ({
                messages: state.messages.map((message) =>
                    message.clientMessageId === clientMessageId
                        ? {
                                ...message,
                                status:
                                    attempt === 1
                                        ? "sending"
                                        : "retrying",
                            }
                        : message
                ),
            }));

            const res = await sendRequest();

            const savedMessage = res.data.data;

            set((state) => ({
                messages: state.messages.map((message) =>
                    message.clientMessageId === clientMessageId
                        ? savedMessage
                        : message
                ),
            }));

            /*
             * Successfully sent/recovered.
             * Stop retrying.
             */
            return;
        } catch (error) {
            console.warn(
                `[Message Retry] attempts=${attempt}/${maxAttempts}`,
                error.message
            );

            /*
             * If this was the final attempt,
             * mark the message as failed.
             */
            if (attempt === maxAttempts) {
                set((state) => ({
                    messages: state.messages.map((message) =>
                        message.clientMessageId === clientMessageId
                            ? {
                                    ...message,
                                    status: "failed",
                                }
                            : message
                    ),
                }));

                toast.error(
                    error.response?.data?.message ||
                        error.message ||
                        "Message cannot be sent"
                );

                return;
            }

            /*
             * Wait before retrying.
             *
             * Attempt 1 → wait 1 second
             * Attempt 2 → wait 2 seconds
             */
            const delay = attempt * 1000;

            await new Promise((resolve) =>
                setTimeout(resolve, delay)
            );
        }
    }
},

    deleteMessage: async (messageId) => {
        try {
            const res = await axiosInstance.delete(
                `/messages/${messageId}`
            );

            const deletedMessage = res.data.data;

            set((state) => ({
                messages: state.messages.map((message) =>
                    message._id === messageId
                        ? {
                                ...message,
                                isDeleted: true,
                                deletedAt: deletedMessage.deletedAt,
                            }
                        : message
                ),
            }));

            toast.success("Message deleted");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    error.message ||
                    "Message deletion failed"
            );
        }
    },

    subscribeToMessage: () => {
        const { selectedUser, isSoundEnabled } = get();

        if (!selectedUser) {
            return;
        }

        const socket = useAuthStore.getState().socket;

        if (!socket) {
            return;
        }

        socket.on("newMessage", (newMessage) => {
            const isMessageSentFromSelectedUser =
                newMessage.senderId === selectedUser._id;

            if (!isMessageSentFromSelectedUser) {
                return;
            }

            const currentMessages = get().messages;

            const lastMessage =
                currentMessages
                    .filter(
                        (message) =>
                            !message.isOptimistic &&
                            message.sequenceNumber != null
                    )
                    .sort(
                        (a, b) =>
                            a.sequenceNumber -
                            b.sequenceNumber
                    )
                    .at(-1);

            if (
                lastMessage &&
                newMessage.sequenceNumber >
                    lastMessage.sequenceNumber + 1
            ) {
                const missingFrom =
                    lastMessage.sequenceNumber + 1;

                const missingTo =
                    newMessage.sequenceNumber - 1;

                for (
                    let sequence = missingFrom;
                    sequence <= missingTo;
                    sequence++
                ) {
                    get().fetchMissingMessage(
                        selectedUser._id,
                        sequence
                    );
                }
            }

            set((state) => {
                const alreadyExists =
                    state.messages.some(
                        (message) =>
                            message.clientMessageId ===
                                newMessage.clientMessageId ||
                            message._id === newMessage._id
                    );

                if (alreadyExists) {
                    return state;
                }

                return {
                    messages: [
                        ...state.messages,
                        newMessage,
                    ].sort(
                        (a, b) =>
                            a.sequenceNumber -
                            b.sequenceNumber
                    ),
                };
            });

            /*
            * Tell the server that this client actually
            * received the message.
            */
            socket.emit("messageDelivered", newMessage._id);

            if (isSoundEnabled) {
                const notificationSound = new Audio(
                    "/sounds/notification.mp3"
                );

                notificationSound.currentTime = 0;

                notificationSound
                    .play()
                    .catch((e) =>
                        console.log(
                            "Audio play failed!",
                            e
                        )
                    );
            }
        });

        socket.on("messageDelivered", ({ messageId, deliveredAt }) => {
            set((state) => ({
                messages: state.messages.map((message) =>
                    message._id === messageId
                        ? {
                                ...message,
                                status: "delivered",
                                deliveredAt,
                            }
                        : message
                ),
            }));
        });

        socket.on("messageRead", ({ messageId, readAt }) => {
            set((state) => ({
                messages: state.messages.map((message) =>
                    message._id === messageId
                        ? {
                                ...message,
                                status: "read",
                                readAt,
                            }
                        : message
                ),
            }));
        });

        socket.on("messageDeleted", ({ messageId, deletedAt }) => {
            set((state) => ({
                messages: state.messages.map((message) =>
                    message._id === messageId
                        ? {
                                ...message,
                                isDeleted: true,
                                deletedAt,
                            }
                        : message
                ),
            }));
        });
    },

    

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;

        if (!socket) {
            return;
        }

        socket.off("newMessage");
        socket.off("messageDelivered");
        socket.off("messageRead");
        socket.off("messageDeleted");
    },

    fetchMissingMessage: async (
        userId,
        sequenceNumber,
        maxAttempts = 3
    ) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const res = await axiosInstance.get(
                    `/messages/${userId}/sequence/${sequenceNumber}`
                );

                const message = res.data.data;

                if (!message) {
                    throw new Error(
                        "Message does not exist"
                    );
                }

                /*
                * Add the recovered message only if
                * it is not already present.
                */
                set((state) => {
                    const alreadyExists =
                        state.messages.some(
                            (existingMessage) =>
                                existingMessage.sequenceNumber ===
                                message.sequenceNumber
                        );

                    if (alreadyExists) {
                        return state;
                    }

                    return {
                        messages: [
                            ...state.messages,
                            message,
                        ].sort(
                            (a, b) =>
                                a.sequenceNumber -
                                b.sequenceNumber
                        ),
                    };
                });

                console.log(
                    `Missing message ${sequenceNumber} recovered on attempt ${attempt}`
                );

                return message;
            } catch {
                console.log(
                    `Attempt ${attempt}/${maxAttempts} failed for sequence ${sequenceNumber}`
                );

                if (attempt === maxAttempts) {
                    console.error(
                        `Message ${sequenceNumber} could not be recovered after ${maxAttempts} attempts`
                    );

                    return null;
                }

                /*
                * Small delay before retrying.
                *
                * 500ms → 1000ms
                */
                await new Promise((resolve) =>
                    setTimeout(
                        resolve,
                        500 * attempt
                    )
                );
            }
        }

        return null;
    },
    
}))