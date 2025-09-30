import * as puppeteer from 'puppeteer';

export class Imposter {
  private mouseSpeed: number;
  private defaultDelay: number;

  constructor() {
    this.mouseSpeed = 1.2;
    this.defaultDelay = 150;
  }

  async humanLikeClick(page: puppeteer.Page, x: number, y: number): Promise<void> {
    await this.moveMouseHumanLike(page, x, y);

    await new Promise(resolve => setTimeout(resolve, this.getRandomDelay(50, 150)));

    await page.mouse.down();

    await new Promise(resolve => setTimeout(resolve, this.getRandomDelay(30, 80)));

    await page.mouse.up();
  }

  private async moveMouseHumanLike(page: puppeteer.Page, targetX: number, targetY: number): Promise<void> {
    const currentPosition = await this.getCurrentMousePosition(page);

    const controlPoints = this.generateBezierControlPoints(
      currentPosition.x,
      currentPosition.y,
      targetX,
      targetY
    );

    const steps = this.calculateSteps(currentPosition, { x: targetX, y: targetY });

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.calculateBezierPoint(
        currentPosition,
        controlPoints[0],
        controlPoints[1],
        { x: targetX, y: targetY },
        t
      );

      const wobble = this.addHumanWobble(point, t);

      await page.mouse.move(wobble.x, wobble.y);

      const delay = this.getVariableDelay(t);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private async getCurrentMousePosition(page: puppeteer.Page): Promise<{ x: number, y: number }> {
    return await page.evaluate(() => {
      return {
        x: (window as any).mouseX || 0,
        y: (window as any).mouseY || 0
      };
    });
  }

  private generateBezierControlPoints(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): [{ x: number, y: number }, { x: number, y: number }] {
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

  private calculateBezierPoint(
    p0: { x: number, y: number },
    p1: { x: number, y: number },
    p2: { x: number, y: number },
    p3: { x: number, y: number },
    t: number
  ): { x: number, y: number } {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

    return { x, y };
  }

  private calculateSteps(start: { x: number, y: number }, end: { x: number, y: number }): number {
    const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    return Math.max(20, Math.min(100, Math.floor(distance / 5)));
  }

  private addHumanWobble(point: { x: number, y: number }, t: number): { x: number, y: number } {
    const wobbleIntensity = Math.sin(t * Math.PI) * 2;

    const wobbleX = (Math.random() - 0.5) * wobbleIntensity;
    const wobbleY = (Math.random() - 0.5) * wobbleIntensity;

    return {
      x: point.x + wobbleX,
      y: point.y + wobbleY
    };
  }

  private getVariableDelay(t: number): number {
    const baseDelay = 5;
    const variability = 3;

    const speedVariation = Math.sin(t * Math.PI * 2) * variability;

    return Math.max(1, baseDelay + speedVariation + Math.random() * 2);
  }

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

  async humanLikeType(page: puppeteer.Page, selector: string, text: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) return;

    await element.click();

    for (const char of text) {
      const typingDelay = this.getRandomDelay(50, 150);
      await new Promise(resolve => setTimeout(resolve, typingDelay));

      await page.keyboard.type(char);

      if (Math.random() < 0.02) {
        await new Promise(resolve => setTimeout(resolve, this.getRandomDelay(500, 1500)));
      }
    }
  }

  async humanLikeScroll(page: puppeteer.Page, distance: number): Promise<void> {
    const steps = Math.abs(distance) / 100;
    const direction = distance > 0 ? 1 : -1;

    for (let i = 0; i < steps; i++) {
      const scrollAmount = 100 * direction + (Math.random() - 0.5) * 20;

      await page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, scrollAmount);

      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay(50, 150)));
    }
  }

  /**
   * Public wrapper for move mouse with human-like behavior to target position
   */
  async moveMouseToTarget(page: puppeteer.Page, target: { x: number; y: number }): Promise<void> {
    await this.moveMouseHumanLike(page, target.x, target.y);
  }

  /**
   * Click with human-like behavior at target position
   */
  async clickHumanLike(page: puppeteer.Page, target: { x: number; y: number }): Promise<void> {
    await this.humanLikeClick(page, target.x, target.y);
  }

  /**
   * Human-like delay between min and max milliseconds
   */
  public async humanDelay(min: number, max: number): Promise<void> {
    const delay = this.getRandomDelay(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate random offset within range
   */
  public randomOffset(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Simulate human reading time based on text length
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
   */
  async thinkingDelay(): Promise<void> {
    await this.humanDelay(800, 2000);
  }

  /**
   * Random mouse movements to simulate human idle behavior
   */
  async idleMouseMovements(page: puppeteer.Page, duration: number = 3000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const viewport = await page.viewport();
      if (!viewport) break;

      const randomX = Math.random() * viewport.width;
      const randomY = Math.random() * viewport.height;

      await this.moveMouseHumanLike(page, randomX, randomY);
      await this.humanDelay(500, 1500);
    }
  }
}

export default Imposter;