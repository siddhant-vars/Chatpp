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
import { server,app } from "./lib/socket.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = ENV.PORT || 8000

app.use(express.json({limit: "5mb"}))
app.use(cors({origin: ENV.CLIENT_URL, credentials: true}))
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
app.use(errorHandler)




server.listen(port, () => {
    console.log(`Server is listening on port: ${port}`)
    connectDB()
})