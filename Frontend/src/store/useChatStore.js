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
        const {selectedUser, messages} = get()
        const {authUser} = useAuthStore.getState()
        const tempId = `temp-${Date.now()}`
        const optimisticMessage = {
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            text: messageData.text,
            image: messageData.image,
            createdAt: new Date().toISOString(),
            isOptimistic: true,
        };
        set({messages: [...messages, optimisticMessage]})
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`,messageData)
            set({messages: messages.concat(res.data.data)})
        } catch (error) {
            set({messages: messages})
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Messages cannot be send"
            )
        }
    }
}))