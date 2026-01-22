import aj from "../lib/arcjet.js";
import {isSpoofedBot} from "@arcjet/inspect";
import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";

export const arcjetProtection = asynchandler( async(req, res, next) => {
    let decision;
    try {
        decision = await aj.protect(req);
    } catch (err) {
        throw new ApiError(503, "Security service unavailable");
    }

    if(decision.isDenied()) {
        if(decision.reason.isRateLimit()) {
            throw new ApiError(429, "Rate limit exceeded. Please try again later")
        } else if(decision.reason.isBot()) {
            throw new ApiError(403, "Bot access is denied")
        } else {
            throw new ApiError(403, "Access denied by security policy")
        }
    }
    if(decision.results.some(isSpoofedBot)) {
        throw new ApiError(403, "malicious bot activity detected", ["Spoofed bot activity detected"])
    }
    next()
})