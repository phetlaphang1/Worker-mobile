/**
 * MobileImposter - Human-like behavior simulation for mobile automation
 * Adapted from Imposter.ts (Puppeteer) to work with ADB mobile automation
 *
 * Core behaviors:
 * - Human-like tap with random offset and delays
 * - Human-like typing with variable speed
 * - Human-like swipe with Bézier curves
 * - Gaussian random delays
 * - Reading time simulation
 * - Thinking pauses
 */

export interface MobileHelpers {
  tap: (x: number, y: number, options?: any) => Promise<void>;
  type: (text: string) => Promise<void>;
  swipe: (x1: number, y1: number, x2: number, y2: number, duration?: number) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
}

export class MobileImposter {
  private defaultTapDelay: number;
  private defaultTypeDelay: number;

  constructor() {
    this.defaultTapDelay = 200;
    this.defaultTypeDelay = 120;
  }

  /**
   * Human-like tap with random offset and delays
   * Adapted from humanLikeClick() in Imposter.ts
   */
  async humanTap(
    helpers: MobileHelpers,
    x: number,
    y: number,
    options?: {
      preTapDelay?: [number, number];
      postTapDelay?: [number, number];
      offsetRange?: number;
    }
  ): Promise<void> {
    const {
      preTapDelay = [50, 150],
      postTapDelay = [100, 300],
      offsetRange = 15
    } = options || {};

    // 1. Pre-tap delay (like moving cursor to target)
    await this.humanDelay(preTapDelay[0], preTapDelay[1]);

    // 2. Random offset (fat finger effect)
    const offsetX = (Math.random() - 0.5) * offsetRange * 2;
    const offsetY = (Math.random() - 0.5) * offsetRange * 2;

    const targetX = Math.round(x + offsetX);
    const targetY = Math.round(y + offsetY);

    // 3. Execute tap
    await helpers.tap(targetX, targetY, { tolerance: 0 }); // Disable default tolerance since we add our own

    // 4. Post-tap delay (like releasing finger)
    await this.humanDelay(postTapDelay[0], postTapDelay[1]);
  }

  /**
   * Human-like typing with variable speed and random pauses
   * Adapted from humanLikeType() in Imposter.ts
   */
  async humanType(
    helpers: MobileHelpers,
    text: string,
    options?: {
      charDelay?: [number, number];
      pauseChance?: number;
      pauseDelay?: [number, number];
    }
  ): Promise<void> {
    const {
      charDelay = [80, 200],
      pauseChance = 0.03, // 3% chance to pause
      pauseDelay = [500, 1500]
    } = options || {};

    for (const char of text) {
      // Random typing delay per character
      const typingDelay = this.getRandomDelay(charDelay[0], charDelay[1]);
      await helpers.sleep(typingDelay);

      // Type single character
      await helpers.type(char);

      // Random chance to pause (thinking/hesitation)
      if (Math.random() < pauseChance) {
        await this.humanDelay(pauseDelay[0], pauseDelay[1]);
      }
    }
  }

  /**
   * Human-like swipe with Bézier curve path
   * Adapted from moveMouseHumanLike() in Imposter.ts
   */
  async humanSwipe(
    helpers: MobileHelpers,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options?: {
      addCurve?: boolean;
      wobble?: boolean;
      durationRange?: [number, number];
    }
  ): Promise<void> {
    const {
      addCurve = true,
      wobble = true,
      durationRange = [300, 600]
    } = options || {};

    if (!addCurve && !wobble) {
      // Simple straight swipe
      const duration = this.getRandomDelay(durationRange[0], durationRange[1]);
      await helpers.swipe(x1, y1, x2, y2, duration);
      await this.humanDelay(200, 500);
      return;
    }

    // Generate Bézier control points for curved swipe
    const controlPoints = this.generateBezierControlPoints(x1, y1, x2, y2);

    // Calculate number of steps based on distance
    const steps = this.calculateSteps({ x: x1, y: y1 }, { x: x2, y: y2 });

    // Generate touch points along Bézier curve
    const touchPoints: Array<{ x: number; y: number }> = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.calculateBezierPoint(
        { x: x1, y: y1 },
        controlPoints[0],
        controlPoints[1],
        { x: x2, y: y2 },
        t
      );

      // Add human wobble if enabled
      const finalPoint = wobble ? this.addHumanWobble(point, t) : point;
      touchPoints.push({
        x: Math.round(finalPoint.x),
        y: Math.round(finalPoint.y)
      });
    }

    // Execute multi-point swipe
    // For ADB, we simulate this with multiple quick swipes
    const duration = this.getRandomDelay(durationRange[0], durationRange[1]);
    const totalSteps = touchPoints.length - 1;
    const stepDuration = Math.max(10, Math.floor(duration / totalSteps));

    for (let i = 0; i < totalSteps; i++) {
      const start = touchPoints[i];
      const end = touchPoints[i + 1];
      await helpers.swipe(start.x, start.y, end.x, end.y, stepDuration);
    }

    // Post-swipe delay
    await this.humanDelay(200, 500);
  }

  /**
   * Human-like scroll (swipe up/down)
   * Adapted from humanLikeScroll() in Imposter.ts
   */
  async humanScroll(
    helpers: MobileHelpers,
    distance: number, // Positive = down, Negative = up
    options?: {
      centerX?: number;
      startY?: number;
    }
  ): Promise<void> {
    const { centerX = 180, startY = 400 } = options || {};

    const steps = Math.abs(distance) / 100;
    const direction = distance > 0 ? 1 : -1;

    for (let i = 0; i < steps; i++) {
      const scrollAmount = 100 * direction + (Math.random() - 0.5) * 20;

      const y1 = startY;
      const y2 = startY + scrollAmount;

      await this.humanSwipe(helpers, centerX, y1, centerX, y2, {
        addCurve: false,
        wobble: true,
        durationRange: [200, 400]
      });

      await this.humanDelay(50, 150);
    }
  }

  /**
   * Generate Bézier control points for curved path
   * COPIED from Imposter.ts
   */
  private generateBezierControlPoints(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): [{ x: number; y: number }, { x: number; y: number }] {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    const offsetRange = 50;
    const offset1X = (Math.random() - 0.5) * offsetRange;
    const offset1Y = (Math.random() - 0.5) * offsetRange;
    const offset2X = (Math.random() - 0.5) * offsetRange;
    const offset2Y = (Math.random() - 0.5) * offsetRange;

    return [
      { x: midX + offset1X, y: midY + offset1Y },
      { x: midX + offset2X, y: midY + offset2Y }
    ];
  }

  /**
   * Calculate Bézier curve point at t (0 to 1)
   * COPIED from Imposter.ts
   */
  private calculateBezierPoint(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

    return { x, y };
  }

  /**
   * Calculate steps based on distance
   * COPIED from Imposter.ts
   */
  private calculateSteps(start: { x: number; y: number }, end: { x: number; y: number }): number {
    const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    return Math.max(10, Math.min(50, Math.floor(distance / 10))); // Less steps than mouse (mobile touch is faster)
  }

  /**
   * Add human wobble to point
   * COPIED from Imposter.ts
   */
  private addHumanWobble(point: { x: number; y: number }, t: number): { x: number; y: number } {
    const wobbleIntensity = Math.sin(t * Math.PI) * 3; // Slightly more wobble for mobile

    const wobbleX = (Math.random() - 0.5) * wobbleIntensity;
    const wobbleY = (Math.random() - 0.5) * wobbleIntensity;

    return {
      x: point.x + wobbleX,
      y: point.y + wobbleY
    };
  }

  /**
   * Get variable delay based on position t
   * COPIED from Imposter.ts
   */
  private getVariableDelay(t: number): number {
    const baseDelay = 5;
    const variability = 3;

    const speedVariation = Math.sin(t * Math.PI * 2) * variability;

    return Math.max(1, baseDelay + speedVariation + Math.random() * 2);
  }

  /**
   * Gaussian random delay - CORE ALGORITHM
   * COPIED 100% from Imposter.ts
   */
  public getRandomDelay(min: number, max: number): number {
    const gaussian = () => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    const normalized = (gaussian() + 3) / 6;
    const clamped = Math.max(0, Math.min(1, normalized));

    return min + (max - min) * clamped;
  }

  /**
   * Human delay with Gaussian distribution
   * COPIED from Imposter.ts
   */
  public async humanDelay(min: number, max: number): Promise<void> {
    const delay = this.getRandomDelay(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Random offset within range
   * COPIED from Imposter.ts
   */
  public randomOffset(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Simulate human reading time based on text length
   * COPIED from Imposter.ts
   */
  async readingDelay(textLength: number): Promise<void> {
    // Average reading speed: 200-250 words per minute
    // Assuming average word length of 5 characters
    const words = textLength / 5;
    const readingTimeMs = (words / 250) * 60 * 1000;
    const actualDelay = this.getRandomDelay(readingTimeMs * 0.8, readingTimeMs * 1.2);
    await new Promise(resolve => setTimeout(resolve, actualDelay));
  }

  /**
   * Simulate human thinking/hesitation
   * COPIED from Imposter.ts
   */
  async thinkingDelay(): Promise<void> {
    await this.humanDelay(800, 2000);
  }

  /**
   * Quick tap (less delay)
   */
  async quickTap(helpers: MobileHelpers, x: number, y: number): Promise<void> {
    await this.humanTap(helpers, x, y, {
      preTapDelay: [20, 50],
      postTapDelay: [50, 100],
      offsetRange: 10
    });
  }

  /**
   * Slow tap (more delay, more careful)
   */
  async slowTap(helpers: MobileHelpers, x: number, y: number): Promise<void> {
    await this.humanTap(helpers, x, y, {
      preTapDelay: [200, 400],
      postTapDelay: [300, 600],
      offsetRange: 20
    });
  }

  /**
   * Random idle behavior (tap random locations)
   */
  async idleBehavior(helpers: MobileHelpers, duration: number = 3000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const randomX = 100 + Math.random() * 200;
      const randomY = 200 + Math.random() * 400;

      await this.humanSwipe(helpers, randomX, randomY, randomX + 50, randomY + 50, {
        addCurve: true,
        wobble: true
      });

      await this.humanDelay(500, 1500);
    }
  }
}

export default MobileImposter;
