import express from "express";
import authroutes from "./routes/auth.route.js"
import path from "path"
import { fileURLToPath } from "url";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = ENV.PORT || 8000

app.use(express.json())

app.use("/api/auth",authroutes)

if(ENV.NODE_ENV == "production") {
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