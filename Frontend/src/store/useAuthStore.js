import {create} from "zustand";

export const useAuthStore = create((set) => ({
    authUser: { name: "Siddhant", _id: 123, age: 25},
    isLoading: false,
    
    login: () => {
        console.log("We just logged in");
    }
}))