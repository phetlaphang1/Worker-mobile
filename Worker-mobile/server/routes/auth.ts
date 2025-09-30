import { Express, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

export function setupAuthRoutes(app: Express) {
  // Login route
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      // Validate credentials
      if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        throw new Error('Admin credentials not configured');
      }

      // Simple password check (in production, passwords should be hashed in database)
      if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Create JWT token
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT secret not configured');
      }

      const token = jwt.sign(
        { username },
        process.env.JWT_SECRET as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' } as any
      );

      logger.info(`User ${username} logged in successfully`);
      res.json({ token });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Verify token route
  app.get('/api/auth/verify', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT secret not configured');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
      res.json({ valid: true, user: decoded });
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  });

  // Logout route (client-side should remove token)
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ message: 'Logged out successfully' });
  });
}