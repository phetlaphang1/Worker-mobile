/**
 * API Routes for Profile Isolation (GemLogin-like features)
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import ProfileIsolationService from '../services/ProfileIsolationService.js';
import SessionManager from '../services/SessionManager.js';
import ActionRecorder from '../services/ActionRecorder.js';

export function setupIsolationRoutes(
  router: express.Router,
  isolationService: ProfileIsolationService,
  sessionManager: SessionManager,
  actionRecorder: ActionRecorder
): void {
  // ============= Profile Isolation =============

  // Setup complete isolation for a profile
  router.post('/api/isolation/setup/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const options = req.body;

      const config = await isolationService.setupProfileIsolation(profileId, options);

      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Failed to setup profile isolation:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to setup isolation'
      });
    }
  });

  // Activate isolated profile
  router.post('/api/isolation/activate/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const options = req.body;

      await isolationService.activateIsolatedProfile(profileId, options);

      res.json({
        success: true,
        message: `Profile ${profileId} activated with full isolation`
      });
    } catch (error) {
      logger.error('Failed to activate isolated profile:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to activate profile'
      });
    }
  });

  // Deactivate isolated profile
  router.post('/api/isolation/deactivate/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const options = req.body;

      await isolationService.deactivateIsolatedProfile(profileId, options);

      res.json({
        success: true,
        message: `Profile ${profileId} deactivated`
      });
    } catch (error) {
      logger.error('Failed to deactivate isolated profile:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to deactivate profile'
      });
    }
  });

  // Clone isolated profile
  router.post('/api/isolation/clone/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { newName, options } = req.body;

      const newProfile = await isolationService.cloneIsolatedProfile(profileId, newName, options);

      res.json({
        success: true,
        profile: newProfile
      });
    } catch (error) {
      logger.error('Failed to clone isolated profile:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to clone profile'
      });
    }
  });

  // Rotate profile identity
  router.post('/api/isolation/rotate/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const options = req.body;

      await isolationService.rotateProfileIdentity(profileId, options);

      res.json({
        success: true,
        message: `Profile ${profileId} identity rotated`
      });
    } catch (error) {
      logger.error('Failed to rotate profile identity:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to rotate identity'
      });
    }
  });

  // Get isolation config
  router.get('/api/isolation/:profileId', (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const config = isolationService.getIsolationConfig(profileId);

      if (!config) {
        return res.status(404).json({
          error: 'Profile isolation not configured'
        });
      }

      res.json({ config });
    } catch (error) {
      logger.error('Failed to get isolation config:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get config'
      });
    }
  });

  // Get all isolation configs
  router.get('/api/isolation', (req, res) => {
    try {
      const configs = isolationService.getAllIsolationConfigs();
      res.json({ configs });
    } catch (error) {
      logger.error('Failed to get isolation configs:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get configs'
      });
    }
  });

  // Get isolation stats
  router.get('/api/isolation/stats', (req, res) => {
    try {
      const stats = isolationService.getStats();
      res.json({ stats });
    } catch (error) {
      logger.error('Failed to get isolation stats:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get stats'
      });
    }
  });

  // ============= Session Management =============

  // Save session
  router.post('/api/sessions/save/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { port, options } = req.body;

      const session = await sessionManager.saveSession(profileId, port, options);

      res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error('Failed to save session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save session'
      });
    }
  });

  // Restore session
  router.post('/api/sessions/restore/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { port, options } = req.body;

      await sessionManager.restoreSession(profileId, port, options);

      res.json({
        success: true,
        message: `Session restored for profile ${profileId}`
      });
    } catch (error) {
      logger.error('Failed to restore session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to restore session'
      });
    }
  });

  // Get session
  router.get('/api/sessions/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const session = await sessionManager.getSession(profileId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found'
        });
      }

      res.json({ session });
    } catch (error) {
      logger.error('Failed to get session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get session'
      });
    }
  });

  // Delete session
  router.delete('/api/sessions/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      await sessionManager.deleteSession(profileId);

      res.json({
        success: true,
        message: `Session deleted for profile ${profileId}`
      });
    } catch (error) {
      logger.error('Failed to delete session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete session'
      });
    }
  });

  // Clear cookies
  router.post('/api/sessions/clear-cookies/:profileId', async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { port } = req.body;

      await sessionManager.clearCookies(profileId, port);

      res.json({
        success: true,
        message: `Cookies cleared for profile ${profileId}`
      });
    } catch (error) {
      logger.error('Failed to clear cookies:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to clear cookies'
      });
    }
  });

  // Get session stats
  router.get('/api/sessions/stats', (req, res) => {
    try {
      const stats = sessionManager.getStats();
      res.json({ stats });
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get stats'
      });
    }
  });

  // ============= Action Recording & Playback =============

  // Start recording
  router.post('/api/actions/start-recording', async (req, res) => {
    try {
      const { scriptName, options } = req.body;
      const scriptId = await actionRecorder.startRecording(scriptName, options);

      res.json({
        success: true,
        scriptId,
        message: `Started recording: ${scriptName}`
      });
    } catch (error) {
      logger.error('Failed to start recording:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to start recording'
      });
    }
  });

  // Stop recording
  router.post('/api/actions/stop-recording', async (req, res) => {
    try {
      const script = await actionRecorder.stopRecording();

      res.json({
        success: true,
        script
      });
    } catch (error) {
      logger.error('Failed to stop recording:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to stop recording'
      });
    }
  });

  // Record click
  router.post('/api/actions/record-click', async (req, res) => {
    try {
      const { port, selector, takeScreenshot } = req.body;
      await actionRecorder.recordClick(port, selector, takeScreenshot);

      res.json({
        success: true,
        message: 'Click recorded'
      });
    } catch (error) {
      logger.error('Failed to record click:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to record click'
      });
    }
  });

  // Record type
  router.post('/api/actions/record-type', async (req, res) => {
    try {
      const { port, selector, text } = req.body;
      await actionRecorder.recordType(port, selector, text);

      res.json({
        success: true,
        message: 'Type action recorded'
      });
    } catch (error) {
      logger.error('Failed to record type:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to record type'
      });
    }
  });

  // Record swipe
  router.post('/api/actions/record-swipe', async (req, res) => {
    try {
      const { port, startX, startY, endX, endY, duration } = req.body;
      await actionRecorder.recordSwipe(port, startX, startY, endX, endY, duration);

      res.json({
        success: true,
        message: 'Swipe recorded'
      });
    } catch (error) {
      logger.error('Failed to record swipe:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to record swipe'
      });
    }
  });

  // Record wait
  router.post('/api/actions/record-wait', (req, res) => {
    try {
      const { duration, condition } = req.body;
      actionRecorder.recordWait(duration, condition);

      res.json({
        success: true,
        message: 'Wait recorded'
      });
    } catch (error) {
      logger.error('Failed to record wait:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to record wait'
      });
    }
  });

  // Playback script
  router.post('/api/actions/playback/:scriptId', async (req, res) => {
    try {
      const scriptId = req.params.scriptId;
      const { port, options } = req.body;

      await actionRecorder.playback(scriptId, port, options);

      res.json({
        success: true,
        message: `Script ${scriptId} played back successfully`
      });
    } catch (error) {
      logger.error('Failed to playback script:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to playback script'
      });
    }
  });

  // Get all scripts
  router.get('/api/actions/scripts', (req, res) => {
    try {
      const scripts = actionRecorder.getAllScripts();
      res.json({ scripts });
    } catch (error) {
      logger.error('Failed to get scripts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get scripts'
      });
    }
  });

  // Get script by ID
  router.get('/api/actions/scripts/:scriptId', (req, res) => {
    try {
      const scriptId = req.params.scriptId;
      const script = actionRecorder.getScript(scriptId);

      if (!script) {
        return res.status(404).json({
          error: 'Script not found'
        });
      }

      res.json({ script });
    } catch (error) {
      logger.error('Failed to get script:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get script'
      });
    }
  });

  // Delete script
  router.delete('/api/actions/scripts/:scriptId', async (req, res) => {
    try {
      const scriptId = req.params.scriptId;
      await actionRecorder.deleteScript(scriptId);

      res.json({
        success: true,
        message: `Script ${scriptId} deleted`
      });
    } catch (error) {
      logger.error('Failed to delete script:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete script'
      });
    }
  });

  // Update script
  router.put('/api/actions/scripts/:scriptId', async (req, res) => {
    try {
      const scriptId = req.params.scriptId;
      const updates = req.body;

      const script = await actionRecorder.updateScript(scriptId, updates);

      res.json({
        success: true,
        script
      });
    } catch (error) {
      logger.error('Failed to update script:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update script'
      });
    }
  });

  // Get action recorder stats
  router.get('/api/actions/stats', (req, res) => {
    try {
      const stats = actionRecorder.getStats();
      res.json({ stats });
    } catch (error) {
      logger.error('Failed to get action recorder stats:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get stats'
      });
    }
  });

  logger.info('Profile Isolation routes configured');
}

export default setupIsolationRoutes;
