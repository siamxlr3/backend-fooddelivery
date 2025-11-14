import dotenv from "dotenv";
dotenv.config();


import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"


import FoodRouter from "../src/routes/FoodRoute.js"
import UserRouter from "../src/routes/UserRoute.js"
import CartRouter from "../src/routes/CartRoute.js"
import FoodCategoryRouter from "../src/routes/FoodCategoryRoute.js"

const app = express();
app.use(express.json())
app.use(cors({
    origin:"http://localhost:3000",
    credentials: true,
}))
app.use(cookieParser())



app.use("/api/food",FoodRouter)
app.use("/api/user",UserRouter)
app.use("/api/cart",CartRouter)
app.use("/api/category",FoodCategoryRouter)

const Port=process.env.PORT || 3000;
app.listen(Port,()=>{
    console.log(`Server started on port ${Port}`)
})