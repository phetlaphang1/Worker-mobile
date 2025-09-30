import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

export function registerAuthRoutes(app: Express) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Validate credentials
      if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        throw new Error('Admin credentials not configured');
      }
      
      if (username !== process.env.ADMIN_USERNAME ||         
            !await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Create JWT token
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT secret not configured');
      }
      
      const token = jwt.sign(
        { username },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.json({ token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
}
