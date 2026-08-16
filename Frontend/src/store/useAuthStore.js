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
        console.log("connectSocket called");

        const { authUser, socket } = get();

        console.log("authUser:", authUser?._id);
        console.log("existing socket:", socket?.id);
        console.log("existing connected:", socket?.connected);
        console.log("existing active:", socket?.active);

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
            transports: ["websocket"],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        set({ socket: newSocket });

        newSocket.on("connect", () => {
            console.log("=================================");
            console.log("SOCKET CONNECTED");
            console.log("Socket ID:", newSocket.id);
            console.log("Transport:", newSocket.io.engine.transport.name);
            console.log("=================================");
        });

        newSocket.on("connect_error", (error) => {
            console.error("=================================");
            console.error("SOCKET CONNECTION ERROR");
            console.error("Message:", error.message);
            console.error("Description:", error.description);
            console.error("Context:", error.context);
            console.error("=================================");
        });

        newSocket.on("disconnect", (reason, details) => {
            console.error("=================================");
            console.error("SOCKET DISCONNECTED");
            console.error("Reason:", reason);
            console.error("Details:", details);
            console.error("=================================");
        });

        newSocket.on("getOnlineUsers", (userIds) => {
            console.log("GLOBAL ONLINE USERS:", userIds);
            set({ onlineUsers: userIds });
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