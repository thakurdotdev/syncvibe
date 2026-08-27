import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getUploadSignature } from './cloudinary-upload.controller';

export const uploadRouter: Router = Router();

uploadRouter.get('/upload/signature', authMiddleware, getUploadSignature);
