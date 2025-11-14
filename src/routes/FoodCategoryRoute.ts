import express from "express";
import upload from "../utilitis/Multer.js";
import {
    createCategory, deleteCategory,
    getAll, getFoodCountByCategory,
    getOneCategory,
    searchCategory,
    updateCategory
} from "../controller/FoodCategoryController.js";

const router = express.Router();


router.post("/create", upload.single("image"), createCategory);
router.get("/search", searchCategory);
router.get("/", getAll);
router.get("/:id", getOneCategory);
router.put("/:id", upload.single("image"), updateCategory);
router.delete("/:id", deleteCategory);
router.get("/:id", getFoodCountByCategory);


export default router;