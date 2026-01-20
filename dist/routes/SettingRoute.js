import express from 'express';
import { getSettings, updateMultipleSettings, updateSetting } from '../controller/SettingController.js';
const router = express.Router();
router.get('/', getSettings);
router.put('/', updateMultipleSettings);
router.patch('/:key', updateSetting);
export default router;
