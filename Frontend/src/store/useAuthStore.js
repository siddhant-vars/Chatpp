import {create} from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast"

export const useAuthStore = create((set) => ({
    authUser: null,
    isCheckingAuth: true,
    isSigningUp: false,
    isLoggining: false,

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({authUser: res.data.data || res.data})
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
    }

}))