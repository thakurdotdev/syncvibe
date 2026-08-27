import { v2 as Cloudinary } from 'cloudinary';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import type { Request } from 'express';
import { configDotenv } from 'dotenv';

configDotenv();

export const security =
  process.env.NODE_ENV === 'production'
    ? helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'", 'https://syncvibe.thakur.dev'],
            scriptSrc: ["'self'", 'https://syncvibe.thakur.dev'],
            styleSrc: ["'self'", 'https://syncvibe.thakur.dev', "'unsafe-inline'"],
            imgSrc: ["'self'", 'https://syncvibe.thakur.dev', 'https://res.cloudinary.com'],
            connectSrc: ["'self'", 'https://syncvibe.thakur.dev', 'https://api.cloudinary.com'],
            objectSrc: ["'none'"],
          },
        },
      })
    : helmet();

Cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true,
});

export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 200,
  delayMs: (used, req) =>
    Math.min(
      (used - (req as unknown as { slowDown: { limit: number } }).slowDown.limit) * 500,
      10000
    ),
  keyGenerator: (req: Request) => req.ip || '',
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || '',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many payment requests, please try again later' },
  keyGenerator: (req: Request) => (req.user?.userid ? String(req.user.userid) : req.ip || ''),
});

export * from './constants';
export * from './upload';
