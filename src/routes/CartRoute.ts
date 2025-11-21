import express from 'express';
import {createCart, getAll, getOne, remove, update} from "../controller/CartController.js";
import {VerifyToken} from "../middleware/VerifyToken.js";
import {VerifyAdmin} from "../middleware/VerifyAdmin.js";

const router = express.Router();

router.post("/create",VerifyToken, createCart);
router.get("/",VerifyToken,getAll);
router.get("/:id",VerifyToken,VerifyAdmin,getOne);
router.delete("/:id",VerifyToken, remove);
router.put("/:id",VerifyToken,VerifyAdmin, update);


export default router;