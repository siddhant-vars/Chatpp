import express from "express";
import dotenv from "dotenv";
import authroutes from "./routes/auth.route.js"
import path from "path"
import { fileURLToPath } from "url";
import { connectDB } from "./lib/db.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 8000

app.use(express.json())

app.use("/api/auth",authroutes)

if(process.env.NODE_ENV == "production") {
    const frontendpath = path.join(__dirname, "../../Frontend/dist");

    app.use(express.static(frontendpath))

    app.get("*",(req, res) => {
        res.sendFile(path.join(frontendpath, "index.html"))
    })
}




app.listen(port, () => {
    console.log(`Server is listening on port: ${port}`)
    connectDB()
})