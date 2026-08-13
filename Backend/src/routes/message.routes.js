import express from "express";
import { 
    getAllContacts, 
    getMessagesbyUserId, 
    sendMessage, 
    getAllChats,
    deleteMessage,
} from "../controller/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import {arcjetProtection} from "../middleware/arcjet.middleware.js"

const router = express.Router();
router.use(arcjetProtection, protectRoute)

router.get("/contacts",getAllContacts);
router.get("/chats", getAllChats);
router.get("/:id",getMessagesbyUserId);
router.post("/send/:id", sendMessage);
router.delete("/:messageId", deleteMessage);

export default router