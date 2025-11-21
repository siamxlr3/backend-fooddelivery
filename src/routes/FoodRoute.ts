import express from "express";
import {createFood, getAll, getOne, remove, search, update} from "../controller/FoodController.js";
import upload from "../utilitis/Multer.js";
import {VerifyToken} from "../middleware/VerifyToken.js";
import {VerifyAdmin} from "../middleware/VerifyAdmin.js";

const router = express.Router();

router.post("/create", upload.single("image"),VerifyToken,VerifyAdmin,createFood);
router.get("/search", search);
router.get("/", getAll);
router.get("/:id", getOne);
router.put("/:id", upload.single("image"),VerifyToken,VerifyAdmin,update);
router.delete("/:id",VerifyToken,VerifyAdmin,remove);


export default router;