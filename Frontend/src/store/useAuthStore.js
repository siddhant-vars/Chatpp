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
        } catch (error) {
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
        const {authUser} = get();
        if(!authUser || get().socket?.connected) return;

        const socket = io(BASE_URL,{
            withCredentials: true
        })
        socket.connect();
        set({socket})
        socket.on("getOnlineUsers",(userIds) => {
            set({onlineUsers: userIds})
        })
    },

    disconnectSocket: () => {
        if(get().socket?.connected) get().socket?.disconnect();
    }


}))