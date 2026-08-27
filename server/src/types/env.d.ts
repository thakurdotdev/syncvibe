declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      CLIENT_URL: string;

      // Database
      DATABASE_URL: string;

      // Redis
      REDIS_URL?: string;

      // JWT
      JWT_SECRET: string;

      // Cloudinary
      CLOUD_NAME: string;
      CLOUDINARY_KEY: string;
      CLOUDINARY_SECRET: string;

      // Google OAuth
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      GOOGLE_CALLBACK_URL: string;

      // Email (Resend)
      RESEND_API_KEY: string;
      RESEND_EMAIL?: string;
      PRODUCTION_DOMAINS?: string;

      // Encryption
      ENCRYPTION_KEY: string;
      ENCRYPTION_IV: string;

      // Music sync
      SONG_API_URL: string;
      MUSIC_SYNC_INTERVAL_HOURS?: string;
      MUSIC_SYNC_BATCH_SIZE?: string;
      MUSIC_SYNC_BATCH_DELAY_MS?: string;
      MUSIC_SYNC_MODE?: string;

      // Razorpay
      RAZORPAY_TEST_API_KEY: string;
      RAZORPAY_TEST_API_SECRET: string;
      RAZORPAY_WEBHOOK_SECRET: string;

      // Cloudflare TURN
      CLOUDFLARE_TURN_TOKEN_ID: string;
      CLOUDFLARE_TURN_API_TOKEN: string;

      // Admin
      ADMIN_EMAIL?: string;

      // Cloudflare R2
      R2_ENDPOINT: string;
      R2_ACCESS_KEY_ID: string;
      R2_SECRET_ACCESS_KEY: string;
      R2_BUCKET_NAME: string;
      R2_PUBLIC_URL: string;

      // EAS
      EAS_WEBHOOK_SECRET?: string;

      // Klipy
      KLIPY_API_KEY?: string;
    }
  }
}

export {};
