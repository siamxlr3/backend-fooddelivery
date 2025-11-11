import express from "express";
import {createFood, getAll, getOne, remove, search, update} from "../controller/FoodController.js";
import upload from "../utilitis/Multer.js";

const router = express.Router();

router.post("/create", upload.single("image"), createFood);
router.get("/search", search);
router.get("/", getAll);
router.get("/:id", getOne);
router.put("/:id", upload.single("image"), update);
router.delete("/:id", remove);


export default router;