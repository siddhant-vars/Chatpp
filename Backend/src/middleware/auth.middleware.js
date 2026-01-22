import jwt from "jsonwebtoken"
import User from "../models/user.models.js"
import { ENV } from "../lib/env.js"
import { asynchandler } from "../utils/asynchandler.js"
import { ApiError } from "../utils/ApiError.js"

export const protectRoute = asynchandler( async(req, res, next) => {
    const token = req.cookies.jwt;
    if(!token) {
        throw new ApiError(401, "Unauthorized-No token provided")
    }
    const decodedtoken = jwt.verify(token, ENV.SECRET_TOKEN)
    if(!decodedtoken) {
        throw new ApiError(401, "Unauthorized - Invalid token")
    }
    const user = await User.findById(decodedtoken.userId).select("-password")
    if(!user) {
        throw new ApiError(404, "User not found")
    }
    req.user = user
    next()
})