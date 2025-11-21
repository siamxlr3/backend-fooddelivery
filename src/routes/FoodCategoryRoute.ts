import express from "express";
import upload from "../utilitis/Multer.js";
import {
    createCategory, deleteCategory,
    getAll, getFoodCountByCategory,
    getOneCategory,
    searchCategory,
    updateCategory
} from "../controller/FoodCategoryController.js";
import {VerifyToken} from "../middleware/VerifyToken.js";
import {VerifyAdmin} from "../middleware/VerifyAdmin.js";

const router = express.Router();


router.post("/create", upload.single("image"),VerifyToken,VerifyAdmin,createCategory);
router.get("/search", searchCategory);
router.get("/", getAll);
router.get("/:id", getOneCategory);
router.put("/:id", upload.single("image"),VerifyToken,VerifyAdmin,updateCategory);
router.delete("/:id",VerifyToken,VerifyAdmin,deleteCategory);
router.get("/:id", getFoodCountByCategory);


export default router;