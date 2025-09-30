import { Page } from 'puppeteer';

/**
 * Navigate to URL with retry logic for network errors
 */
export async function safeNavigate(
  page: Page,
  url: string,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Navigation attempt ${attempt}/${maxRetries} to ${url}`);

      // Try to navigate with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      console.log('Navigation successful');
      return; // Success, exit function

    } catch (error: any) {
      lastError = error;
      console.error(`Navigation attempt ${attempt} failed:`, error.message);

      // Check if it's a network error
      const isNetworkError = error.message.includes('ERR_NETWORK_CHANGED') ||
                           error.message.includes('ERR_INTERNET_DISCONNECTED') ||
                           error.message.includes('ERR_CONNECTION_REFUSED') ||
                           error.message.includes('ERR_CONNECTION_RESET') ||
                           error.message.includes('ERR_CONNECTION_TIMED_OUT') ||
                           error.message.includes('ERR_NAME_NOT_RESOLVED');

      if (isNetworkError && attempt < maxRetries) {
        console.log(`Network error detected, waiting before retry...`);

        // Wait before retry (exponential backoff)
        const waitTime = Math.min(attempt * 2000, 10000);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Check if page is still valid
        if (page.isClosed()) {
          throw new Error('Page was closed, cannot retry');
        }

        // Try to refresh DNS and clear cache
        try {
          await page.evaluate(() => {
            // Clear any cached data
            if ('caches' in window) {
              caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
              });
            }
          });
        } catch (e) {
          // Ignore cache clear errors
        }

      } else if (!isNetworkError) {
        // Non-network error, don't retry
        throw error;
      }
    }
  }

  // All retries failed
  throw new Error(`Failed to navigate after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * Check network connectivity
 */
export async function checkNetworkConnectivity(page: Page): Promise<boolean> {
  try {
    // Try to fetch a simple URL
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors'
        });
        return true;
      } catch {
        return false;
      }
    });

    return result;
  } catch {
    return false;
  }
}

/**
 * Wait for network to be stable
 */
export async function waitForNetworkStability(
  page: Page,
  maxWaitTime: number = 30000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const isConnected = await checkNetworkConnectivity(page);

    if (isConnected) {
      console.log('Network connectivity confirmed');
      return;
    }

    console.log('Waiting for network stability...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Network not stable after timeout');
}