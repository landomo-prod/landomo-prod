import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel || 'info',
  base: { service: 'notification', country: config.country },
});
