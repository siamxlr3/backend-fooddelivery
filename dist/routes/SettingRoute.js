import express from 'express';
import { getSettings, updateMultipleSettings, updateSetting, uploadLogo } from '../controller/SettingController.js';
import upload from '../utilitis/Multer.js';
const router = express.Router();
router.get('/', getSettings);
router.put('/', updateMultipleSettings);
router.patch('/:key', updateSetting);
router.post('/logo-upload', upload.single('logo'), uploadLogo);
export default router;
