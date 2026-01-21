import {asynchandler} from "../utils/asynchandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import User from "../models/user.models.js"

import bcrypt from "bcryptjs"
import { generateToken } from "../utils/generateToken.js"

export const signup =  asynchandler(async (req, res) => {
    const {fullname, email, password} = req.body

    if(!fullname || !email || !password) {
        throw new ApiError(400, "All fields are required")
    }
    if(password.length < 6) {
        throw new ApiError(400, "password must be atleast six characters")
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, "Invalid email address")
    }

    const user = await User.findOne({email})
    if(user) {
        throw new ApiError(400, "Email already exists")
    }

    const salt = await bcrypt.genSalt(10)
    const hashedpassword = await bcrypt.hash(password, salt)

    const newUser = await User.create({
        fullname,
        email,
        password: hashedpassword
    })

    generateToken(newUser._id, res)

    const createdUser = await User.findById(newUser._id).select("-password")

    if(!createdUser){
        throw new ApiError(400, "invalid user data")
    }

    return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "UserCreated successfully"))

})