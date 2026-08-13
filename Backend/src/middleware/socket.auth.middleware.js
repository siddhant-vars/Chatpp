import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import { ENV } from "../lib/env.js";

export const socketAuthMiddleware = async (socket, next) => {
	try {
		const cookieHeader = socket.handshake.headers.cookie;

		const token = cookieHeader
			?.split("; ")
			.find((row) => row.startsWith("jwt="))
			?.split("=")[1];

		if (!token) {
			console.log(
				"Socket connection rejected: No token provided"
			);

			return next(new Error("Unauthorized - No token provided"));
		}

		const decodedToken = jwt.verify(
			token,
			ENV.SECRET_TOKEN
		);

		if (!decodedToken?.userId) {
			console.log(
				"Socket connection rejected: Invalid token"
			);

			return next(new Error("Unauthorized - Invalid token"));
		}

		const user = await User.findById(
			decodedToken.userId
		).select("-password");

		if (!user) {
			console.log(
				"Socket connection rejected: User not found"
			);

			return next(new Error("User not found"));
		}

		socket.user = user;
		socket.userId = user._id.toString();

		console.log(
			`Socket authenticated for user: ${user.fullname} (${user._id})`
		);

		next();
	} catch (error) {
		console.error(
			"Socket authentication error:",
			error.message
		);

		next(new Error("Unauthorized - Invalid authentication"));
	}
};