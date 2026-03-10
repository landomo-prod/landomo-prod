import dotenv from 'dotenv';
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3300'),
    host: process.env.HOST || '0.0.0.0',
  },
  country: process.env.COUNTRY || 'czech',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  facebook: {
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
    pageId: process.env.FB_PAGE_ID || '',
    sessionDir: process.env.FB_SESSION_DIR || '/data/sessions',
    screenshotDir: process.env.FB_SCREENSHOT_DIR || '/data/screenshots',
  },
  rateLimits: {
    maxPagePostsPerHour: parseInt(process.env.MAX_PAGE_POSTS_PER_HOUR || '25'),
    maxGroupPostsPerHour: parseInt(process.env.MAX_GROUP_POSTS_PER_HOUR || '5'),
    maxGroupPostsPerDay: parseInt(process.env.MAX_GROUP_POSTS_PER_DAY || '20'),
  },
  ai: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'DeepSeek-V3-2',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
  },
};
