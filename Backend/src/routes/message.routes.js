import express from "express";
import { getAllContacts, getMessagesbyUserId, sendMessage, getAllChats } from "../controller/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/contacts",protectRoute,getAllContacts);
router.get("/chats", protectRoute,getAllChats);
router.get("/:id",protectRoute,getMessagesbyUserId);
router.post("/send/:id", protectRoute, sendMessage);

export default router