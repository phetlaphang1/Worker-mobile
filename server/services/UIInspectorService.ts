import LDPlayerController from '../core/LDPlayerController.js';
import { DOMParser } from 'xmldom';
import * as xpath from 'xpath';
import { logger } from '../utils/logger.js';

export interface UIElement {
  xpath: string;
  text: string;
  resourceId: string;
  className: string;
  contentDesc: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  center: { x: number; y: number };
  clickable: boolean;
  enabled: boolean;
  attributes: Record<string, string>;
}

export interface XPathSuggestion {
  xpath: string;
  priority: number;
  description: string;
}

/**
 * UI Inspector Service - Auto generate XPath từ UI hierarchy
 */
export class UIInspectorService {
  private controller: LDPlayerController;

  constructor(controller: LDPlayerController) {
    this.controller = controller;
  }

  /**
   * Dump UI hierarchy và parse thành JSON (with retry)
   */
  async dumpUIHierarchy(deviceSerial: string, retries = 3): Promise<string> {
    logger.info(`Dumping UI hierarchy for device: ${deviceSerial}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Clear old dump first
        try {
          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell rm -f /sdcard/window_dump.xml'
          );
        } catch (e) {
          // Ignore error if file doesn't exist
        }

        // Small delay to let the system stabilize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Dump UI to XML
        await this.controller.executeAdbCommand(
          deviceSerial,
          'shell uiautomator dump /sdcard/window_dump.xml'
        );

        // Wait a bit for dump to complete
        await new Promise(resolve => setTimeout(resolve, 300));

        // Read XML
        const xml = await this.controller.executeAdbCommand(
          deviceSerial,
          'shell cat /sdcard/window_dump.xml'
        );

        // Verify XML is valid
        if (xml && xml.includes('<?xml') && xml.includes('hierarchy')) {
          logger.info(`UI dump successful on attempt ${attempt}`);
          return xml;
        } else {
          throw new Error('Invalid XML output');
        }
      } catch (error: any) {
        logger.warn(`UI dump attempt ${attempt}/${retries} failed:`, error.message);

        if (attempt === retries) {
          throw new Error(`Failed to dump UI after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new Error('Failed to dump UI hierarchy');
  }

  /**
   * Parse UI XML thành array of elements
   */
  parseUIElements(xmlString: string): UIElement[] {
    const elements: UIElement[] = [];

    try {
      const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
      const allNodes = xpath.select('//*[@bounds]', doc) as any[];

      allNodes.forEach((node, index) => {
        const boundsAttr = node.getAttribute('bounds');
        if (!boundsAttr) return;

        const boundsMatch = boundsAttr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (!boundsMatch) return;

        const [, x1Str, y1Str, x2Str, y2Str] = boundsMatch;
        const x1 = parseInt(x1Str);
        const y1 = parseInt(y1Str);
        const x2 = parseInt(x2Str);
        const y2 = parseInt(y2Str);

        const element: UIElement = {
          xpath: this.generateXPathForNode(node),
          text: node.getAttribute('text') || '',
          resourceId: node.getAttribute('resource-id') || '',
          className: node.getAttribute('class') || '',
          contentDesc: node.getAttribute('content-desc') || '',
          bounds: { x1, y1, x2, y2 },
          center: {
            x: Math.floor((x1 + x2) / 2),
            y: Math.floor((y1 + y2) / 2)
          },
          clickable: node.getAttribute('clickable') === 'true',
          enabled: node.getAttribute('enabled') === 'true',
          attributes: this.getAllAttributes(node)
        };

        elements.push(element);
      });

      logger.info(`Parsed ${elements.length} UI elements`);
      return elements;
    } catch (error: any) {
      logger.error('Failed to parse UI elements:', error);
      throw new Error(`Failed to parse UI: ${error.message}`);
    }
  }

  /**
   * Tìm element tại tọa độ (x, y) - với tolerance
   */
  findElementAtPosition(elements: UIElement[], x: number, y: number): UIElement | null {
    // First try: Find element that contains the point exactly
    let matchingElements = elements.filter(element => {
      const { x1, y1, x2, y2 } = element.bounds;
      return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    });

    if (matchingElements.length > 0) {
      // Return the smallest element (most specific)
      matchingElements.sort((a, b) => {
        const areaA = (a.bounds.x2 - a.bounds.x1) * (a.bounds.y2 - a.bounds.y1);
        const areaB = (b.bounds.x2 - b.bounds.x1) * (b.bounds.y2 - b.bounds.y1);
        return areaA - areaB;
      });

      // Prefer elements with text or clickable
      const withText = matchingElements.find(el => el.text || el.contentDesc);
      const clickable = matchingElements.find(el => el.clickable);

      return withText || clickable || matchingElements[0];
    }

    // Second try: Find nearest clickable element within tolerance (50px)
    const tolerance = 50;
    const nearbyElements = elements.filter(element => {
      const { x1, y1, x2, y2 } = element.bounds;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      return distance <= tolerance && (element.clickable || element.text || element.contentDesc);
    });

    if (nearbyElements.length > 0) {
      // Sort by distance
      nearbyElements.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(x - (a.bounds.x1 + a.bounds.x2) / 2, 2) +
          Math.pow(y - (a.bounds.y1 + a.bounds.y2) / 2, 2)
        );
        const distB = Math.sqrt(
          Math.pow(x - (b.bounds.x1 + b.bounds.x2) / 2, 2) +
          Math.pow(y - (b.bounds.y1 + b.bounds.y2) / 2, 2)
        );
        return distA - distB;
      });

      logger.info(`Found nearby element at distance from (${x}, ${y})`);
      return nearbyElements[0];
    }

    return null;
  }

  /**
   * Generate multiple XPath suggestions cho element
   */
  generateXPathSuggestions(element: UIElement, allElements: UIElement[]): XPathSuggestion[] {
    const suggestions: XPathSuggestion[] = [];

    // 1. By resource-id (nếu unique)
    if (element.resourceId) {
      const count = allElements.filter(e => e.resourceId === element.resourceId).length;
      if (count === 1) {
        suggestions.push({
          xpath: `//*[@resource-id="${element.resourceId}"]`,
          priority: 1,
          description: 'By unique resource-id (most stable)'
        });
      } else {
        suggestions.push({
          xpath: `//${element.className}[@resource-id="${element.resourceId}"]`,
          priority: 3,
          description: `By resource-id + class (${count} matches)`
        });
      }
    }

    // 2. By text (nếu có)
    if (element.text) {
      const count = allElements.filter(e => e.text === element.text).length;
      if (count === 1) {
        suggestions.push({
          xpath: `//*[@text="${element.text}"]`,
          priority: 2,
          description: 'By unique text'
        });
      } else {
        suggestions.push({
          xpath: `//${element.className}[@text="${element.text}"]`,
          priority: 4,
          description: `By text + class (${count} matches)`
        });
      }

      // Contains text
      suggestions.push({
        xpath: `//*[contains(@text, "${element.text}")]`,
        priority: 6,
        description: 'By text contains (flexible)'
      });
    }

    // 3. By content-desc
    if (element.contentDesc) {
      const count = allElements.filter(e => e.contentDesc === element.contentDesc).length;
      suggestions.push({
        xpath: `//*[@content-desc="${element.contentDesc}"]`,
        priority: count === 1 ? 2 : 5,
        description: `By content-desc (${count === 1 ? 'unique' : count + ' matches'})`
      });
    }

    // 4. By class + clickable (cho buttons)
    if (element.clickable) {
      suggestions.push({
        xpath: `//${element.className}[@clickable="true"]`,
        priority: 7,
        description: 'By class + clickable'
      });
    }

    // 5. By class only
    const classSameCount = allElements.filter(e => e.className === element.className).length;
    const classIndex = allElements.filter(e => e.className === element.className)
      .findIndex(e => e.center.x === element.center.x && e.center.y === element.center.y) + 1;

    suggestions.push({
      xpath: `//${element.className}[${classIndex}]`,
      priority: 8,
      description: `By class + index (${classIndex} of ${classSameCount})`
    });

    // 6. Combined attributes (stable)
    if (element.text && element.clickable) {
      suggestions.push({
        xpath: `//${element.className}[@text="${element.text}" and @clickable="true"]`,
        priority: 3,
        description: 'By text + clickable (stable)'
      });
    }

    // Sort by priority (lower = better)
    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate XPath for a node (basic)
   */
  private generateXPathForNode(node: any): string {
    const className = node.getAttribute('class') || 'node';
    const resourceId = node.getAttribute('resource-id');
    const text = node.getAttribute('text');

    if (resourceId) {
      return `//*[@resource-id="${resourceId}"]`;
    } else if (text) {
      return `//${className}[@text="${text}"]`;
    } else {
      return `//${className}`;
    }
  }

  /**
   * Get all attributes from node
   */
  private getAllAttributes(node: any): Record<string, string> {
    const attrs: Record<string, string> = {};

    if (!node.attributes) return attrs;

    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      attrs[attr.name] = attr.value;
    }

    return attrs;
  }

  /**
   * Screenshot with element bounds highlighted
   */
  async screenshotWithHighlight(
    deviceSerial: string,
    element: UIElement
  ): Promise<string> {
    const screenshotPath = `/sdcard/screenshot_${Date.now()}.png`;

    await this.controller.executeAdbCommand(
      deviceSerial,
      `shell screencap -p ${screenshotPath}`
    );

    logger.info(`Screenshot saved with highlight at ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Get UI dump và elements cho một instance
   */
  async inspectInstance(port: number): Promise<{
    xml: string;
    elements: UIElement[];
    screenshot?: string;
  }> {
    // Resolve device serial
    const deviceSerial = await this.controller.resolveAdbSerial(port);

    // Dump UI
    const xml = await this.dumpUIHierarchy(deviceSerial);

    // Parse elements
    const elements = this.parseUIElements(xml);

    return { xml, elements };
  }

  /**
   * Find element at coordinates và generate XPath suggestions
   */
  async getXPathAtPosition(
    port: number,
    x: number,
    y: number
  ): Promise<{
    element: UIElement | null;
    suggestions: XPathSuggestion[];
  }> {
    const { elements } = await this.inspectInstance(port);
    const element = this.findElementAtPosition(elements, x, y);

    if (!element) {
      return { element: null, suggestions: [] };
    }

    const suggestions = this.generateXPathSuggestions(element, elements);

    return { element, suggestions };
  }

  /**
   * Search elements by text (contains match)
   */
  async searchByText(
    port: number,
    searchText: string
  ): Promise<{
    elements: UIElement[];
    count: number;
  }> {
    const { elements } = await this.inspectInstance(port);

    const matches = elements.filter(el =>
      el.text.toLowerCase().includes(searchText.toLowerCase()) ||
      el.contentDesc.toLowerCase().includes(searchText.toLowerCase())
    );

    logger.info(`Found ${matches.length} elements matching text: "${searchText}"`);

    return {
      elements: matches,
      count: matches.length
    };
  }

  /**
   * Search elements by resource-id
   */
  async searchByResourceId(
    port: number,
    resourceId: string
  ): Promise<{
    elements: UIElement[];
    count: number;
  }> {
    const { elements } = await this.inspectInstance(port);

    const matches = elements.filter(el =>
      el.resourceId.toLowerCase().includes(resourceId.toLowerCase())
    );

    logger.info(`Found ${matches.length} elements matching resource-id: "${resourceId}"`);

    return {
      elements: matches,
      count: matches.length
    };
  }

  /**
   * Get all interactive elements (clickable, enabled)
   */
  async getInteractiveElements(port: number): Promise<{
    elements: UIElement[];
    count: number;
  }> {
    const { elements } = await this.inspectInstance(port);

    const interactive = elements.filter(el =>
      el.clickable && el.enabled
    );

    logger.info(`Found ${interactive.length} interactive elements`);

    return {
      elements: interactive,
      count: interactive.length
    };
  }

  /**
   * Filter elements by class name
   */
  async filterByClass(
    port: number,
    className: string
  ): Promise<{
    elements: UIElement[];
    count: number;
  }> {
    const { elements } = await this.inspectInstance(port);

    const matches = elements.filter(el =>
      el.className.toLowerCase().includes(className.toLowerCase())
    );

    logger.info(`Found ${matches.length} elements with class: "${className}"`);

    return {
      elements: matches,
      count: matches.length
    };
  }

  /**
   * Smart search - tìm theo nhiều tiêu chí
   */
  async smartSearch(
    port: number,
    query: string,
    options?: {
      searchText?: boolean;
      searchResourceId?: boolean;
      searchClass?: boolean;
      onlyClickable?: boolean;
    }
  ): Promise<{
    elements: Array<UIElement & { matchReason: string }>;
    count: number;
  }> {
    const { elements } = await this.inspectInstance(port);

    const opts = {
      searchText: true,
      searchResourceId: true,
      searchClass: true,
      onlyClickable: false,
      ...options
    };

    const matches: Array<UIElement & { matchReason: string }> = [];
    const queryLower = query.toLowerCase();

    for (const el of elements) {
      if (opts.onlyClickable && !el.clickable) continue;

      let matchReason = '';

      if (opts.searchText && el.text.toLowerCase().includes(queryLower)) {
        matchReason = `Text: "${el.text}"`;
      } else if (opts.searchText && el.contentDesc.toLowerCase().includes(queryLower)) {
        matchReason = `Content-desc: "${el.contentDesc}"`;
      } else if (opts.searchResourceId && el.resourceId.toLowerCase().includes(queryLower)) {
        matchReason = `Resource-id: "${el.resourceId}"`;
      } else if (opts.searchClass && el.className.toLowerCase().includes(queryLower)) {
        matchReason = `Class: "${el.className}"`;
      }

      if (matchReason) {
        matches.push({
          ...el,
          matchReason
        });
      }
    }

    logger.info(`Smart search "${query}" found ${matches.length} elements`);

    return {
      elements: matches,
      count: matches.length
    };
  }
}

export default UIInspectorService;
