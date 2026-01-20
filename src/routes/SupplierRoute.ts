import express from 'express';
import { createSupplier, getSuppliers, updateSupplier, deleteSupplier } from '../controller/SupplierController.js';

const router = express.Router();

router.post('/', createSupplier);
router.get('/', getSuppliers);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;
