import { Express } from 'express';
import path from 'path';
import fs from 'fs';

export const registerTwitterCaringRoutes = (app: Express) => {
  // Get all Twitter caring data
  app.get('/api/twitters/caring', (req, res) => {
    try {
      const twitterCaringPath = path.join(process.cwd(), 'storage', 'local', 'twitterCaring.json');
      
      // Check if file exists
      if (!fs.existsSync(twitterCaringPath)) {
        return res.json([]);
      }
      
      // Read and parse the JSON file
      const data = fs.readFileSync(twitterCaringPath, 'utf8');
      const twitterCaringData = JSON.parse(data);
      
      // Return the entries array or the whole data if it's already an array
      const result = twitterCaringData.entries || twitterCaringData;
      res.json(result);
    } catch (error) {
      console.error('Error reading Twitter caring data:', error);
      res.status(500).json({ error: 'Failed to load Twitter caring data' });
    }
  });

  // Get Twitter caring data for specific profile ID
  app.get('/api/twitters/caring/:id', (req, res) => {
    try {
      const profileId = parseInt(req.params.id);
      
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }
      
      const twitterCaringPath = path.join(process.cwd(), 'storage', 'local', 'twitterCaring.json');
      
      // Check if file exists
      if (!fs.existsSync(twitterCaringPath)) {
        return res.json(null);
      }
      
      // Read and parse the JSON file
      const data = fs.readFileSync(twitterCaringPath, 'utf8');
      const twitterCaringData = JSON.parse(data);
      
      // Get the entries array
      const entries = twitterCaringData.entries || twitterCaringData;
      
      // Find data for the specific profile ID
      const profileData = Array.isArray(entries) 
        ? entries.filter((item: any) => item.profileId === profileId || item.prd === profileId)
        : null;
      
      res.json(profileData);
    } catch (error) {
      console.error('Error reading Twitter caring data for profile:', req.params.id, error);
      res.status(500).json({ error: 'Failed to load Twitter caring data for profile' });
    }
  });
};