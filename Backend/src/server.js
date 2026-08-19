import express from "express";
import authroutes from "./routes/auth.route.js"
import path from "path"
import { fileURLToPath } from "url";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import cookieParser from "cookie-parser"
import messageRoutes from "./routes/message.routes.js"
import cors from "cors"
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import { server,app,io } from "./lib/socket.js";
import {
	connectRedis,
	getOnlineUserIdsFromRedis
} from "./lib/redisPubSub.js";
import {
	getReceiverSocketIds,
    getAllSocketIds,
} from "./lib/socketRegistry.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = ENV.PORT || 8000

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
];

if (ENV.FRONTEND_URL) {
    allowedOrigins.push(ENV.FRONTEND_URL);
}

app.use(express.json({limit: "5mb"}))
app.use(cors({origin: allowedOrigins, credentials: true}))
app.use(cookieParser())

app.use("/api/auth",authroutes)
app.use("/api/messages", messageRoutes);

if(ENV.NODE_ENV == "production") {
    const frontendpath = path.join(__dirname, "../../Frontend/dist");

    app.use(express.static(frontendpath))

    app.get("*",(req, res) => {
        res.sendFile(path.join(frontendpath, "index.html"))
    })
}
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "ok",
	});
});
app.use(errorHandler)

const startServer = async () => {
	try {
		await connectDB();

		await connectRedis(
			async ({ event, data }) => {
				switch (event) {
					case "newMessage": {
						const socketIds =
							getReceiverSocketIds(
								data.recevierId
							);

						for (const socketId of socketIds) {
							io.to(socketId).emit(
								"newMessage",
								data
							);
						}

						break;
					}

					case "messageDeleted": {
						const socketIds =
							getReceiverSocketIds(
								data.recevierId
							);

						for (const socketId of socketIds) {
							io.to(socketId).emit(
								"messageDeleted",
								data
							);
						}

						break;
					}

					case "messageDelivered": {
						const socketIds =
							getReceiverSocketIds(
								data.senderId
							);

						for (const socketId of socketIds) {
							io.to(socketId).emit(
								"messageDelivered",
								data
							);
						}

						break;
					}

					case "messageRead": {
						const socketIds =
							getReceiverSocketIds(
								data.senderId
							);

						for (const socketId of socketIds) {
							io.to(socketId).emit(
								"messageRead",
								data
							);
						}

						break;
					}

                    case "userOnline": {
						const onlineUserIds =
							await getOnlineUserIdsFromRedis();

						io.emit(
							"getOnlineUsers",
							onlineUserIds
						);

						break;
					}

					case "userOffline": {
						const onlineUserIds =
							await getOnlineUserIdsFromRedis();

						io.emit(
							"getOnlineUsers",
							onlineUserIds
						);

						break;
					}

					default:
						console.warn(
							"Unknown realtime event:",
							event
						);
				}
			}
		);

		server.listen(port, () => {
			console.log(
				`Server is listening on port ${port}`
			);
		});
	} catch (error) {
		console.error(
			"Server startup failed:",
			error
		);

		process.exit(1);
	}
};

startServer();