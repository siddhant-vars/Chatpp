import express from "express";

import {
	signup,
	login,
	logout,
	updateProfile,
} from "../controller/auth.controller.js";

import {
	protectRoute,
} from "../middleware/auth.middleware.js";

import {
	rateLimit,
} from "../middleware/rateLimit.middleware.js";

const router = express.Router();

/*
 * Signup:
 *
 * Maximum 5 attempts per IP
 * within 60 seconds.
 */
const signupRateLimit = rateLimit({
	windowSeconds: 60,
	maxRequests: 5,
	keyPrefix: "signup",
});

/*
 * Login:
 *
 * Maximum 10 attempts per IP
 * within 60 seconds.
 */
const loginRateLimit = rateLimit({
	windowSeconds: 60,
	maxRequests: 10,
	keyPrefix: "login",
});

router.post(
	"/signup",
	signupRateLimit,
	signup
);

router.post(
	"/login",
	loginRateLimit,
	login
);

router.post(
	"/logout",
	logout
);

router.put(
	"/update-profile",
	protectRoute,
	updateProfile
);

router.get(
	"/check",
	protectRoute,
	(req, res) =>
		res.status(200).json(req.user)
);

export default router;
