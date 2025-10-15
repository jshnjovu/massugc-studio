/**
 * Utility to generate connected background images for text overlays
 * This is a synchronous, standalone implementation extracted from ConnectedTextBackground component
 * Used during form submission to ensure fresh, accurate background data
 */

/**
 * Generate connected background image data for a text overlay
 * @param {Object} config - Configuration object
 * @param {string} config.text - The text to render
 * @param {string} config.backgroundColor - Background color (hex)
 * @param {number} config.backgroundOpacity - Opacity (0-100)
 * @param {number} config.backgroundRounded - Border radius
 * @param {number} config.backgroundHeight - Height adjustment (0-100)
 * @param {number} config.backgroundWidth - Width adjustment (0-100)
 * @param {number} config.lineSpacing - Line spacing adjustment
 * @param {number} config.fontSize - Font size in pixels
 * @param {Object} config.style - Text style (fontWeight, fontStyle, fontFamily, etc.)
 * @returns {Object|null} - {image: base64, metadata: {...}} or null if generation fails
 */
export function generateConnectedBackgroundData(config) {
  const {
    text,
    backgroundColor = '#000000',
    backgroundOpacity = 100,
    backgroundRounded = 15,
    backgroundHeight = 50,
    backgroundWidth = 50,
    lineSpacing = 0,
    fontSize = 24,
    style = {}
  } = config;

  const textLines = text.split('\n').filter(line => line.trim() !== '');
  if (!textLines.length) return null;

  try {
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set font for measurements
    const fontWeight = style.fontWeight || 'normal';
    const fontStyle = style.fontStyle || 'normal';
    const fontFamily = style.fontFamily || 'System';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Measure text
    const measurements = textLines.map(line => ({
      text: line,
      width: ctx.measureText(line).width,
      height: fontSize
    }));

    // Calculate padding
    const basePaddingV = fontSize * 0.3;
    const basePaddingH = fontSize * 0.4;
    const verticalPadding = (basePaddingV * backgroundHeight) / 50;
    const horizontalPadding = (basePaddingH * backgroundWidth) / 50;

    // Calculate canvas dimensions
    const maxWidth = Math.max(...measurements.map(m => m.width));
    const maxBubbleWidth = maxWidth + (horizontalPadding * 2);
    const bubbleHeight = fontSize + (verticalPadding * 2);
    const totalHeight = measurements.length * bubbleHeight;
    const canvasWidth = maxBubbleWidth + 20; // Extra padding
    const canvasHeight = totalHeight;

    // Set canvas size with DPR
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    // Set font again after canvas resize
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Calculate text positions
    const baseLineHeight = fontSize * 1.5;
    const spacingAdjustment = (lineSpacing / 10) * fontSize;
    const textLineSpacing = baseLineHeight + spacingAdjustment;
    const textBlockHeight = fontSize + ((measurements.length - 1) * textLineSpacing);
    const textStartY = (totalHeight - textBlockHeight) / 2 + fontSize / 2;

    const textPositions = [];
    for (let i = 0; i < measurements.length; i++) {
      textPositions.push(textStartY + (i * textLineSpacing));
    }

    // Calculate bubble positions
    const bubbles = [];
    for (let i = 0; i < measurements.length; i++) {
      const textWidth = measurements[i].width;
      const bubbleWidth = textWidth + (horizontalPadding * 2);
      const bubbleLeft = (canvasWidth - bubbleWidth) / 2;
      const bubbleTop = i * bubbleHeight;

      bubbles.push({
        left: bubbleLeft,
        right: bubbleLeft + bubbleWidth,
        top: bubbleTop,
        bottom: bubbleTop + bubbleHeight,
        width: bubbleWidth,
        textWidth: textWidth,
        text: measurements[i].text
      });
    }

    // Draw connected backgrounds using ONE continuous path (critical for seamless multi-line backgrounds)
    ctx.fillStyle = `${backgroundColor}${Math.round((backgroundOpacity / 100) * 255).toString(16).padStart(2, '0')}`;
    
    // Calculate radii for outer corners and inner curves
    const outerRadius = backgroundRounded;
    const innerRadius = outerRadius * 0.6; // Smaller radius for inward curves
    
    // Start ONE continuous path
    ctx.beginPath();
    
    // RULE: Start at top-left corner and trace clockwise
    const firstBubble = bubbles[0];
    ctx.moveTo(firstBubble.left + outerRadius, firstBubble.top);
    
    // Top edge
    ctx.lineTo(firstBubble.right - outerRadius, firstBubble.top);
    ctx.arcTo(firstBubble.right, firstBubble.top, firstBubble.right, firstBubble.top + outerRadius, outerRadius);
    
    // Trace down right edge
    for (let i = 0; i < bubbles.length - 1; i++) {
      const current = bubbles[i];
      const next = bubbles[i + 1];
      
      // RULE: Inward curve only if next bubble is narrower
      if (next.width < current.width) {
        // Draw to just before the corner
        ctx.lineTo(current.right, current.bottom - innerRadius);
        // Arc inward
        ctx.arcTo(current.right, current.bottom, current.right - innerRadius, current.bottom, innerRadius);
        // Draw horizontally to where next bubble edge will be
        ctx.lineTo(next.right + innerRadius, next.top);
        // Arc back out to continue down
        ctx.arcTo(next.right, next.top, next.right, next.top + innerRadius, innerRadius);
      } else if (next.width > current.width) {
        // Next is wider - outward curve
        ctx.lineTo(current.right, current.bottom - innerRadius);
        ctx.arcTo(current.right, current.bottom, current.right + innerRadius, current.bottom, innerRadius);
        ctx.lineTo(next.right - innerRadius, next.top);
        ctx.arcTo(next.right, next.top, next.right, next.top + innerRadius, innerRadius);
      } else {
        // Same width - straight line
        ctx.lineTo(current.right, current.bottom);
      }
    }
    
    // Bottom-right corner
    const lastBubble = bubbles[bubbles.length - 1];
    ctx.lineTo(lastBubble.right, lastBubble.bottom - outerRadius);
    ctx.arcTo(lastBubble.right, lastBubble.bottom, lastBubble.right - outerRadius, lastBubble.bottom, outerRadius);
    
    // Bottom edge
    ctx.lineTo(lastBubble.left + outerRadius, lastBubble.bottom);
    ctx.arcTo(lastBubble.left, lastBubble.bottom, lastBubble.left, lastBubble.bottom - outerRadius, outerRadius);
    
    // Trace up left edge
    for (let i = bubbles.length - 1; i > 0; i--) {
      const current = bubbles[i];
      const next = bubbles[i - 1];
      
      // RULE: Inward curve only if next bubble (above) is narrower
      if (next.width < current.width) {
        // Draw up to just after the corner
        ctx.lineTo(current.left, current.top + innerRadius);
        // Arc inward
        ctx.arcTo(current.left, current.top, current.left + innerRadius, current.top, innerRadius);
        // Draw horizontally to where next bubble edge will be
        ctx.lineTo(next.left - innerRadius, next.bottom);
        // Arc back out to continue up
        ctx.arcTo(next.left, next.bottom, next.left, next.bottom - innerRadius, innerRadius);
      } else if (next.width > current.width) {
        // Next is wider - outward curve
        ctx.lineTo(current.left, current.top + innerRadius);
        ctx.arcTo(current.left, current.top, current.left - innerRadius, current.top, innerRadius);
        ctx.lineTo(next.left + innerRadius, next.bottom);
        ctx.arcTo(next.left, next.bottom, next.left, next.bottom - innerRadius, innerRadius);
      } else {
        // Same width - straight line
        ctx.lineTo(current.left, current.top);
      }
    }
    
    // Top-left corner
    ctx.lineTo(firstBubble.left, firstBubble.top + outerRadius);
    ctx.arcTo(firstBubble.left, firstBubble.top, firstBubble.left + outerRadius, firstBubble.top, outerRadius);
    
    // Close and fill the complete connected path
    ctx.closePath();
    ctx.fill();

    // Draw text on top of backgrounds
    // Set font again to ensure it's correct for text drawing
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = style.color || '#000000'; // Use text color from style
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < textLines.length; i++) {
      const x = canvasWidth / 2;
      const y = textPositions[i];
      ctx.fillText(textLines[i], x, y);
    }

    // Get image data
    const imageData = canvas.toDataURL('image/png');

    // Build metadata
    const metadata = {
      width: Math.round(canvasWidth),
      height: Math.round(canvasHeight),
      devicePixelRatio: dpr,
      textPositions: textPositions.map(pos => Math.round(pos)),
      bubblePositions: bubbles.map(bubble => ({
        left: Math.round(bubble.left),
        right: Math.round(bubble.right),
        top: Math.round(bubble.top),
        bottom: Math.round(bubble.bottom),
        width: Math.round(bubble.width),
        textWidth: Math.round(bubble.textWidth),
        text: bubble.text
      })),
      textX: Math.round(canvasWidth / 2),
      textY: Math.round(textPositions[0] || 0),
      backgroundX: 0,
      backgroundY: 0,
      backgroundWidth: Math.round(canvasWidth),
      backgroundHeight: Math.round(canvasHeight)
    };

    return {
      image: imageData,
      metadata: metadata
    };
  } catch (error) {
    console.error('Error generating connected background:', error);
    return null;
  }
}

