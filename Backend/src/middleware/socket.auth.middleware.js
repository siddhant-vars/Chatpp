import jwt from "jsonwebtoken"
import User from "../models/user.models.js"
import { ENV } from "../lib/env.js"
import { asynchandler } from "../utils/asynchandler.js"

export const socketAuthMiddleware = asynchandler(async(socket, next) => {
    const token = socket.handshake.headers.cookie
    ?.split("; ")
    .find((row) => row.startsWith("jwt="))
    ?.split("=")[1];

    if(!token) {
        console.log("Socket Connection rejected: No token provided")
        return next(new Error("Unauthorised-No Token Provided"))
    }
    const decodedtoken = jwt.verify(token,ENV.SECRET_TOKEN);
    if(!decodedtoken) {
        console.log("Socket Connection rejected: Invalid token provided")
        return next(new Error("Unauthorised-Invalid token"))
    }
    const user = await User.findById(decodedtoken.userId).select("-password")
    if(!user) {
        console.log("Socket Connection rejected: No user found")
        return next(new Error("User not found"))
    }
    socket.user = user
    socket.userId = user._id.toString();

    console.log(`Socket authenticated for user: ${user.fullname} (${user._id})`)
    next();
})