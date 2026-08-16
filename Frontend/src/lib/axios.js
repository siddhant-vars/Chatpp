import axios from "axios";

const BASE_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";

export const axiosInstance = axios.create({
    baseURL: `${BASE_URL}/api`,
    withCredentials: true,
});