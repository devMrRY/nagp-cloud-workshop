import { Router } from 'express';
import { serveHomePage, initiateUpload, completeUpload } from '../controller/document.handler.js';
const router = Router();

// Serve files from the compiled `dist/public` folder by filename.
router.get('/', serveHomePage);

router.post('/upload/initiate', initiateUpload);
router.post('/upload/complete', completeUpload);

export default router;