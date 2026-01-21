import mongoose from "mongoose";
import { ENV } from "../lib/env.js";

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(ENV.MONGODB_URI)
        console.log("MONGODB connected", conn.connection.host)
    } catch (error) {
        console.log("mongodb connection failed", error)
        process.exit(1);
    }
}