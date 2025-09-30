import puppeteer, { Page, ElementHandle } from "puppeteer";

export async function pause(time: number): Promise<void> {
    console.log("Pause in " + time + " milliseconds...");    
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

export async function click(page: Page, xpath: string, index: number | null = null): Promise<boolean> {
    console.log("Click: " + xpath);
    let pass = false;
    for(let i = 0; i < 10; i++){
        try {
            const element = await getElement(page, xpath, index);
            await element.click();
            return true;
        } catch (error) {
            console.log("Not present: " + xpath);            
            await pause(3000);
        }
    }
    if(!pass){
        throw new Error("Failed to click: " + xpath);
    }    
    return pass;
}

export async function type(page: Page, xpath: string, text: string): Promise<void> {
    console.log("Type: " + text + " in " + xpath);
    const element = await page.waitForSelector("::-p-xpath(" + xpath + ")");
    if (element) {
        await element.type(text);
    }
}

interface ScrollResult {
    prevHeight: number;
    postHeight: number;
}

export async function scrollToEndOfPage(page: Page): Promise<ScrollResult> {
    const prevHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page
        .waitForFunction(`document.documentElement.scrollHeight > ${prevHeight}`, {
            timeout: 10000,
        })
        .catch(() => console.log("No new content loaded or scroll timeout."));
    await pause(2000);
    const postHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log("Scroll down with height from: " + prevHeight + " to: " + postHeight);
    return { prevHeight, postHeight };
}

export async function scrollToHomeOfPage(page: Page): Promise<ScrollResult> {
    const prevHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(2000);
    const postHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log("Scroll up with height from: " + prevHeight + " to: " + postHeight);
    return { prevHeight, postHeight };
}

export async function checkElement(page: Page, xpath: string): Promise<boolean> {
    try {
        await page.waitForSelector("::-p-xpath(" + xpath + ")", {
            timeout: 1000,
        });
        return true;
    } catch (error) {
        return false;
    }
}

export async function waitForTrueElement(page: Page, time: number, xpathTrue: string, xpathFalse: string): Promise<boolean> {
    let presented = false;

    for (let index = 0; index < time; index++) {
        if (await checkElement(page, xpathTrue)) {
            presented = true;
            break;
        }
        if (await checkElement(page, xpathFalse)) {
            presented = false;
            break;
        }
    }
    if (presented) {
        console.log("Present: " + xpathTrue);
    } else {
        console.log("Not Present: " + xpathTrue);
    }

    return presented;
}

export async function getElements(page: Page, xpath: string): Promise<ElementHandle[]> {
    const elements = await page.$$("xpath/" + xpath);
    return elements;
}

export async function getElement(page: Page, xpath: string, index: number | null = null): Promise<ElementHandle> {
    const elements = await page.$$("xpath/" + xpath);
    return elements[index || 0];
}

export async function getAttributes(page: Page, xpath: string, attributeName: string): Promise<any[]> {
    let attributes: any[] = [];
    const elements = await getElements(page, xpath);
    for (let index = 0; index < elements.length; index++) {
        const element = elements[index];
        const propertyHandle = await element.getProperty(attributeName);
        const propertyValue = await propertyHandle.jsonValue();
        attributes.push(propertyValue);
    }
    return attributes;
}

export async function getAttribute(page: Page, xpath: string, attributeName: string, index: number | null = null): Promise<any> {
    const elements = await getElements(page, xpath);
    const element = elements[index || 0];
    const propertyHandle = await element.getProperty(attributeName);
    const propertyValue = await propertyHandle.jsonValue();
    return propertyValue;
}

export async function getText(page: Page, xpath: string, index: number | null = null): Promise<string> {
    try {
        const elements = await getElements(page, xpath);
        if (elements.length === 0) {
            console.log(`No element found for xpath: ${xpath}`);
            return "";
        }
        const element = elements[index || 0];
        const text = await page.evaluate(el => {
            // Cast to HTMLElement which has innerText
            const htmlEl = el as HTMLElement;
            // Try different methods to get text
            return htmlEl.textContent || (htmlEl.innerText ? htmlEl.innerText : "") || "";
        }, element);
        return text.trim();
    } catch (error) {
        console.log(`Error getting text from ${xpath}: ${error}`);
        return "";
    }
}