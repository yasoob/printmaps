import { test, expect } from '@playwright/test';

test('PageDimensionField - Track Page width modification and canvas update', async ({ page }) => {
  // Navigate to the editor
  await page.goto('http://127.0.0.1:4177/editor/', { waitUntil: 'networkidle' });
  
  // Wait for the page to stabilize
  await page.waitForTimeout(2000);
  
  console.log('\n=== INITIAL STATE ===');
  const pageWidthInput = page.locator('input[aria-label="Page width"]');
  const pageHeightInput = page.locator('input[aria-label="Page height"]');
  const printFrame = page.locator('.print-frame');
  
  // Get initial values
  const initialWidth = await pageWidthInput.inputValue();
  const initialHeight = await pageHeightInput.inputValue();
  const initialAspectRatio = await printFrame.evaluate(el => 
    window.getComputedStyle(el).aspectRatio
  );
  
  console.log('Initial Page width:', initialWidth);
  console.log('Initial Page height:', initialHeight);
  console.log('Initial aspect-ratio (computed):', initialAspectRatio);
  
  // Get the style CSS var
  const styleVar = await printFrame.evaluate(el => 
    getComputedStyle(el).getPropertyValue('--studio-page-ratio')
  );
  console.log('Initial --studio-page-ratio:', styleVar);
  
  // Get inline style aspect-ratio
  const inlineAspectRatio = await printFrame.evaluate(el => 
    el.style.aspectRatio
  );
  console.log('Inline aspect-ratio:', inlineAspectRatio);
  
  console.log('\n=== START MODIFICATION ===');
  console.log('Timestamp:', new Date().toISOString());
  
  // Focus and change width value
  await pageWidthInput.focus();
  await pageWidthInput.fill('250');
  
  console.log('Entered new width: 250');
  console.log('Field value after fill:', await pageWidthInput.inputValue());
  
  // Wait a moment for input event processing
  await page.waitForTimeout(300);
  
  console.log('\n=== BEFORE BLUR (COMMIT) ===');
  console.log('Current width input value:', await pageWidthInput.inputValue());
  console.log('aria-invalid:', await pageWidthInput.getAttribute('aria-invalid'));
  
  // Trigger blur to commit the change
  await pageWidthInput.blur();
  
  console.log('\n=== AFTER BLUR - QUIESCENCE WAIT ===');
  await page.waitForTimeout(1000);
  
  // Get the new state after commit
  const newWidth = await pageWidthInput.inputValue();
  const newHeight = await pageHeightInput.inputValue();
  const newAspectRatio = await printFrame.evaluate(el => 
    window.getComputedStyle(el).aspectRatio
  );
  const newInlineAspectRatio = await printFrame.evaluate(el => 
    el.style.aspectRatio
  );
  const newStyleVar = await printFrame.evaluate(el => 
    getComputedStyle(el).getPropertyValue('--studio-page-ratio')
  );
  
  console.log('New Page width:', newWidth);
  console.log('New Page height:', newHeight);
  console.log('New computed aspect-ratio:', newAspectRatio);
  console.log('New inline aspect-ratio:', newInlineAspectRatio);
  console.log('New --studio-page-ratio:', newStyleVar);
  
  // Check canvas frame updates
  const canvasSurface = page.locator('.canvas-surface');
  const mapRoot = page.locator('.map-root');
  
  console.log('\n=== CANVAS REFERENCES ===');
  const mapReady = await canvasSurface.getAttribute('data-map-ready');
  console.log('Map ready:', mapReady);
  
  // Check for any changed refs in component state
  console.log('\n=== DOCUMENT CHANGES ===');
  console.log('Modification completed: width changed from', initialWidth, 'to', newWidth);
  console.log('Height remains:', newHeight);
  console.log('Canvas frame aspect-ratio updated:', initialAspectRatio, '->', newAspectRatio);
  
  // Verify the print frame geometry
  const printFrameBox = await printFrame.boundingBox();
  console.log('\n=== PRINT FRAME GEOMETRY ===');
  console.log('Print frame visible:', !!printFrameBox);
  if (printFrameBox) {
    console.log('Width:', printFrameBox.width);
    console.log('Height:', printFrameBox.height);
  }
  
  console.log('\n=== SUCCESS: PAGE WIDTH MODIFICATION TRACKED ===');
  console.log('Timestamp end:', new Date().toISOString());
});
