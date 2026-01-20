import express from "express";
import dotenv from "dotenv";
import authroutes from "./routes/auth.route.js"
import path from "path"

dotenv.config();

const app = express();

const _dirname = path.resolve();

const port = process.env.PORT || 8000

app.use("/api/auth",authroutes)

if(process.env.NODE_ENV == "production") {
    const frontendpath = path.join(_dirname, "Frontend", "dist");

    app.use(express.static(frontendpath))

    app.get("*",(req, res) => {
        res.sendFile(path.join(frontendpath, "index.html"))
    })
}




app.listen(port, () => {
    console.log(`Server is listening on port: ${port}`)
})