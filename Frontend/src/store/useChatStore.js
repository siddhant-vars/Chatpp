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
            set({messages: res.data.data})
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

        try {
            const res = await axiosInstance.post(
                `/messages/send/${selectedUser._id}`,
                {
                    ...messageData,
                    clientMessageId,
                }
            );

            const savedMessage = res.data.data;

            set((state) => ({
                messages: state.messages.map((message) =>
                    message.clientMessageId === clientMessageId
                        ? savedMessage
                        : message
                ),
            }));
        } catch (error) {
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

            /*
            * Prevent duplicate messages.
            */
            const alreadyExists = currentMessages.some(
                (message) =>
                    message.clientMessageId ===
                        newMessage.clientMessageId ||
                    message._id === newMessage._id
            );

            if (!alreadyExists) {
                set({
                    messages: [...currentMessages, newMessage],
                });
            }

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
    
}))