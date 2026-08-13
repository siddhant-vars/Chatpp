import {create} from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast"
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development"? "http://localhost:8000" : "/"

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
            get().connectSocket();
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
            get().connectSocket();
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
            get().connectSocket();
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
            if (socket.connected) {
                return;
            }

            socket.connect();
            return;
        }

        const newSocket = io(BASE_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        set({ socket: newSocket });

        newSocket.on("connect", () => {
            console.log(
                "Socket connected:",
                newSocket.id
            );
        });

        newSocket.on("connect_error", (error) => {
            console.error(
                "Socket connection error:",
                error.message
            );
        });

        newSocket.on("disconnect", (reason) => {
            console.log(
                "Socket disconnected:",
                reason
            );
        });

        newSocket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });
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