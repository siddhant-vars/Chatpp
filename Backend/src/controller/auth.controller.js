import {asynchandler} from "../utils/asynchandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import User from "../models/user.models.js"

import bcrypt from "bcryptjs"
import { generateToken } from "../utils/generateToken.js"
import { sendWelcomeEmail } from "../emails/emailHandlers.js"

import { ENV } from "../lib/env.js"
import cloudinary from "../lib/cloudinary.js"

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
    try {
        await sendWelcomeEmail(newUser.email, newUser.fullname, ENV.CLIENT_URL)
    } catch (error) {
        console.log("Failed to send welcome email", error)
    }

    const userResponse = newUser.toObject()
    delete userResponse.password

    return res
    .status(201)
    .json(new ApiResponse(201, userResponse, "UserCreated successfully"))

})

export const login = asynchandler( async(req, res) => {
    const {email, password} = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({email});
    if(!user) {
        throw new ApiError(401, "Invalid credentials")
    }
    const isCorrectPassword = await bcrypt.compare(password,user.password);
    if(!isCorrectPassword) {
        throw new ApiError(401, "Invalid credentials")
    }

    generateToken(user._id, res);

    const loginUser = user.toObject()
    delete loginUser.password

    res
    .status(200)
    .json(new ApiResponse(200,loginUser, "Login successfully"))
})

export const logout = asynchandler( async(_ , res) => {
    res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "strict",
        secure: ENV.NODE_ENV === "development" ? false : true,
    });

    res
    .status(200)
    .json(new ApiResponse(200,{}, "Logged Out successfully"))
})

export const updateProfile = asynchandler( async(req, res) => {
    const {profilePicture} = req.body;
    if(!profilePicture) {
        throw new ApiError(400, "Profile picture is required")
    }

    const UserId = req.user._id;
    if(!UserId) {
        throw new ApiError(401, "Unauthorized Access")
    }
    const uploadResponse = await cloudinary.uploader.upload(profilePicture)

    const updatedUser = await User.findByIdAndUpdate(UserId,{profilePic: uploadResponse.secure_url},{new: true}).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Profilepic added successfully"))
})