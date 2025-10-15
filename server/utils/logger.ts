import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  // Only show warnings and errors in console (90% reduction)
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'warn',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'worker-mobile' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    // Write all logs with level 'info' and below to combined.log (still kept in file)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'info'
    })
  ]
});

// If not in production, also log to console (only warnings and errors)
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    level: 'warn', // Only show warnings and errors in terminal
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}