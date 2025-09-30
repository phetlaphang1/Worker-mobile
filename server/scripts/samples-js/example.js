await page.goto("https://example.com");
console.log("Page title:", await page.title());
await page.screenshot({
  path: `output/screenshot-${config.profileId}.png`,
  fullPage: true,
});
console.log("Screenshot saved successfully!");
