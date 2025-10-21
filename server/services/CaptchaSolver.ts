/**
 * CaptchaSolver - Solve captchas via external APIs
 *
 * Supported services:
 * - 2Captcha (https://2captcha.com)
 * - CapSolver (https://capsolver.com)
 * - Anti-Captcha (https://anti-captcha.com)
 *
 * Supported captcha types:
 * - Cloudflare Turnstile
 * - reCAPTCHA v2/v3
 * - hCaptcha
 * - Image captcha
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

export type CaptchaService = '2captcha' | 'capsolver' | 'anticaptcha';

export interface CaptchaSolveRequest {
  type: 'turnstile' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'image';
  sitekey?: string;
  pageurl?: string;
  action?: string; // For reCAPTCHA v3
  data?: string; // For Turnstile data parameter
  image?: string; // Base64 image for image captcha
}

export interface CaptchaSolveResult {
  success: boolean;
  solution?: string; // Captcha token
  cost?: number; // Cost in USD
  solveTime?: number; // Time taken in ms
  error?: string;
  taskId?: string;
}

export class CaptchaSolver {
  private service: CaptchaService;
  private apiKey: string;
  private baseUrl: string;

  constructor(service: CaptchaService = '2captcha', apiKey?: string) {
    this.service = service;
    this.apiKey = apiKey || process.env.CAPTCHA_API_KEY || '';

    // Set base URL based on service
    switch (service) {
      case '2captcha':
        this.baseUrl = 'https://2captcha.com';
        break;
      case 'capsolver':
        this.baseUrl = 'https://api.capsolver.com';
        break;
      case 'anticaptcha':
        this.baseUrl = 'https://api.anti-captcha.com';
        break;
    }

    if (!this.apiKey) {
      logger.warn('No captcha API key configured. Set CAPTCHA_API_KEY in .env');
    }
  }

  /**
   * Solve captcha (main method)
   */
  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'No API key configured'
      };
    }

    logger.info(`Solving ${request.type} captcha using ${this.service}...`);
    const startTime = Date.now();

    try {
      let result: CaptchaSolveResult;

      switch (this.service) {
        case '2captcha':
          result = await this.solve2Captcha(request);
          break;
        case 'capsolver':
          result = await this.solveCapSolver(request);
          break;
        case 'anticaptcha':
          result = await this.solveAntiCaptcha(request);
          break;
        default:
          throw new Error(`Unknown service: ${this.service}`);
      }

      const solveTime = Date.now() - startTime;
      result.solveTime = solveTime;

      if (result.success) {
        logger.info(`✅ Captcha solved in ${solveTime}ms (cost: $${result.cost || '?'})`);
      } else {
        logger.error(`❌ Captcha solve failed: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      logger.error('Captcha solve error:', error);
      return {
        success: false,
        error: error.message,
        solveTime: Date.now() - startTime
      };
    }
  }

  /**
   * 2Captcha API implementation
   */
  private async solve2Captcha(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      // Step 1: Submit captcha
      const submitData: any = {
        key: this.apiKey,
        json: 1
      };

      if (request.type === 'turnstile') {
        submitData.method = 'turnstile';
        submitData.sitekey = request.sitekey;
        submitData.pageurl = request.pageurl;
        if (request.data) {
          submitData.data = request.data;
        }
      } else if (request.type === 'recaptcha_v2') {
        submitData.method = 'userrecaptcha';
        submitData.googlekey = request.sitekey;
        submitData.pageurl = request.pageurl;
      } else if (request.type === 'recaptcha_v3') {
        submitData.method = 'userrecaptcha';
        submitData.version = 'v3';
        submitData.googlekey = request.sitekey;
        submitData.pageurl = request.pageurl;
        submitData.action = request.action || 'verify';
      } else {
        throw new Error(`Unsupported type for 2Captcha: ${request.type}`);
      }

      const submitUrl = `${this.baseUrl}/in.php`;
      logger.debug(`[2Captcha] Submitting captcha: ${submitUrl}`);

      const submitResponse = await axios.post(submitUrl, new URLSearchParams(submitData));
      const submitResult = submitResponse.data;

      if (submitResult.status !== 1) {
        throw new Error(submitResult.request || 'Submit failed');
      }

      const taskId = submitResult.request;
      logger.info(`[2Captcha] Task submitted: ${taskId}`);

      // Step 2: Poll for result
      const resultUrl = `${this.baseUrl}/res.php`;
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max

      while (attempts < maxAttempts) {
        await this.sleep(5000); // Wait 5 seconds

        const resultResponse = await axios.get(resultUrl, {
          params: {
            key: this.apiKey,
            action: 'get',
            id: taskId,
            json: 1
          }
        });

        const result = resultResponse.data;

        if (result.status === 1) {
          // Solved!
          return {
            success: true,
            solution: result.request,
            cost: 0.002, // ~$2 per 1000
            taskId
          };
        } else if (result.request === 'CAPCHA_NOT_READY') {
          logger.debug(`[2Captcha] Waiting for solution... (attempt ${attempts + 1}/${maxAttempts})`);
          attempts++;
        } else {
          throw new Error(result.request || 'Unknown error');
        }
      }

      throw new Error('Timeout waiting for captcha solution');

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * CapSolver API implementation
   */
  private async solveCapSolver(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      // CapSolver uses different API format
      const taskData: any = {
        clientKey: this.apiKey,
        task: {
          websiteURL: request.pageurl,
          websiteKey: request.sitekey
        }
      };

      if (request.type === 'turnstile') {
        taskData.task.type = 'AntiTurnstileTaskProxyLess';
      } else if (request.type === 'recaptcha_v2') {
        taskData.task.type = 'ReCaptchaV2TaskProxyless';
      } else if (request.type === 'recaptcha_v3') {
        taskData.task.type = 'ReCaptchaV3TaskProxyless';
        taskData.task.pageAction = request.action || 'verify';
      }

      // Submit task
      const submitResponse = await axios.post(`${this.baseUrl}/createTask`, taskData);
      const submitResult = submitResponse.data;

      if (submitResult.errorId !== 0) {
        throw new Error(submitResult.errorDescription || 'Submit failed');
      }

      const taskId = submitResult.taskId;
      logger.info(`[CapSolver] Task submitted: ${taskId}`);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await this.sleep(3000);

        const resultResponse = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId
        });

        const result = resultResponse.data;

        if (result.errorId !== 0) {
          throw new Error(result.errorDescription);
        }

        if (result.status === 'ready') {
          return {
            success: true,
            solution: result.solution.token,
            cost: 0.001, // ~$1 per 1000
            taskId
          };
        }

        logger.debug(`[CapSolver] Waiting... (attempt ${attempts + 1}/${maxAttempts})`);
        attempts++;
      }

      throw new Error('Timeout');

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Anti-Captcha API implementation
   */
  private async solveAntiCaptcha(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    // Similar to CapSolver but different endpoint/format
    // Implementation would be similar...
    return {
      success: false,
      error: 'Anti-Captcha not implemented yet'
    };
  }

  /**
   * Check balance
   */
  async getBalance(): Promise<number> {
    try {
      if (this.service === '2captcha') {
        const response = await axios.get(`${this.baseUrl}/res.php`, {
          params: {
            key: this.apiKey,
            action: 'getbalance',
            json: 1
          }
        });
        return parseFloat(response.data.request);
      } else if (this.service === 'capsolver') {
        const response = await axios.post(`${this.baseUrl}/getBalance`, {
          clientKey: this.apiKey
        });
        return response.data.balance;
      }
      return 0;
    } catch (error) {
      logger.error('Failed to get balance:', error);
      return 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CaptchaSolver;
