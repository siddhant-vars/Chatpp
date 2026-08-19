import {create} from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast"
import { io } from "socket.io-client";

const BASE_URL =
    import.meta.env.VITE_BACKEND_URL;

export const useAuthStore = create((set,get) => ({
    authUser: null,
    isCheckingAuth: true,
    isSigningUp: false,
    isLoggining: false,
    socket: null,
    onlineUsers: [],

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({authUser: res.data.data || res.data})
        } catch {
            set({ authUser: null });
        } finally {
            set({isCheckingAuth: false})
        }
    },

    signup: async (data) => {
        set({ isSigningUp: true });

        try {
            const res = await axiosInstance.post("/auth/signup", data);

            set({ authUser: res.data.data });

            toast.success("Account created successfully!");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Signup failed"
            );
        } finally {
            set({ isSigningUp: false });
        }
    },

    login: async (data) => {
        set({ isLoggining: true });

        try {
            const res = await axiosInstance.post("/auth/login", data);

            set({ authUser: res.data.data });

            toast.success("Login successfully");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Login failed"
            );
        } finally {
            set({ isLoggining: false });
        }
    },

    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout")
            set({authUser: null})
            toast.success("Logout Successfull")
            get().disconnectSocket();
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Logout failed"
            )
        }
    },

    updateProfile: async (data) => {
        try {
            const res = await axiosInstance.put("/auth/update-profile",data);
            set({authUser: res.data.data})
            toast.success("Profile updated successfully")
        } catch (error) {
            console.log("Error in update profile: ", error)
            toast.error(
                error.response?.data?.message ||
                error.message || 
                "Profile update"
            )
        }
    },

    connectSocket: () => {

        const { authUser, socket } = get();

        if (!authUser) {
            return;
        }

        if (socket) {
            if (socket.connected || socket.active) {
                return;
            }

            socket.connect();
            return;
        }

        const newSocket = io(BASE_URL, {
            withCredentials: true,
            transports: ["websocket", "polling"],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        set({ socket: newSocket });

        newSocket.on("connect", () => {
            console.log("[SOCKET CONNECTED]", newSocket.id);
        });

        newSocket.on("connect_error", (error) => {
            console.error("[SOCKET CONNECTION ERROR]", error.message);
        });

        newSocket.on("disconnect", (reason) => {
            console.log("[SOCKET DISCONNECTED]", reason);
        });

        newSocket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });
        newSocket.on("userOnline", ({ userId }) => {

            set((state) => ({
                onlineUsers: state.onlineUsers.includes(userId)
                    ? state.onlineUsers
                    : [...state.onlineUsers, userId],
            }));
        });

        newSocket.on("userOffline", ({ userId }) => {
            console.log("USER OFFLINE:", userId);

            set((state) => ({
                onlineUsers: state.onlineUsers.filter(
                    (id) => id !== userId
                ),
            }));
        });
        newSocket.connect();
        
    },

    disconnectSocket: () => {
        const socket = get().socket;

        if (!socket) {
            return;
        }

        socket.disconnect();

        set({
            socket: null,
            onlineUsers: [],
        });
    },


}))

window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        const { socket } = useAuthStore.getState();
        if (socket && !socket.connected) {
            socket.connect();
        }
    }
});

window.addEventListener("online", () => {
    const { socket } = useAuthStore.getState();
    if (socket && !socket.connected) {
        socket.connect();
    }
});