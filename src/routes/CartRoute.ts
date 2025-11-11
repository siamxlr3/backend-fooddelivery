import express from 'express';
import {createCart, getAll, getOne, remove, update} from "../controller/CartController.js";

const router = express.Router();

router.post("/create", createCart);
router.get("/", getAll);
router.get("/:id", getOne);
router.delete("/:id", remove);
router.put("/:id", update);


export default router;