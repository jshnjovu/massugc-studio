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

    // Draw connected backgrounds
    ctx.fillStyle = `${backgroundColor}${Math.round((backgroundOpacity / 100) * 255).toString(16).padStart(2, '0')}`;

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const prevBubble = i > 0 ? bubbles[i - 1] : null;
      const nextBubble = i < bubbles.length - 1 ? bubbles[i + 1] : null;

      // Start path
      ctx.beginPath();

      // Top-left corner
      if (prevBubble && bubble.left < prevBubble.left) {
        const curveSize = Math.min(backgroundRounded, (prevBubble.left - bubble.left) / 2);
        ctx.moveTo(bubble.left + backgroundRounded, bubble.top);
        ctx.lineTo(prevBubble.left - curveSize, bubble.top);
        ctx.quadraticCurveTo(prevBubble.left, bubble.top, prevBubble.left, bubble.top + curveSize);
        ctx.lineTo(prevBubble.left, prevBubble.bottom);
        ctx.lineTo(bubble.left + backgroundRounded, prevBubble.bottom);
      } else {
        ctx.moveTo(bubble.left + backgroundRounded, bubble.top);
        if (prevBubble) {
          ctx.lineTo(prevBubble.right - backgroundRounded, bubble.top);
        } else {
          ctx.lineTo(bubble.right - backgroundRounded, bubble.top);
        }
      }

      // Top-right corner
      if (prevBubble && bubble.right > prevBubble.right) {
        const curveSize = Math.min(backgroundRounded, (bubble.right - prevBubble.right) / 2);
        ctx.quadraticCurveTo(bubble.right, bubble.top, bubble.right, bubble.top + curveSize);
        ctx.lineTo(bubble.right, bubble.bottom - backgroundRounded);
      } else {
        ctx.arc(bubble.right - backgroundRounded, bubble.top + backgroundRounded, backgroundRounded, -Math.PI / 2, 0);
        ctx.lineTo(bubble.right, bubble.bottom - backgroundRounded);
      }

      // Bottom-right corner
      if (nextBubble && bubble.right > nextBubble.right) {
        const curveSize = Math.min(backgroundRounded, (bubble.right - nextBubble.right) / 2);
        ctx.quadraticCurveTo(bubble.right, bubble.bottom, bubble.right - curveSize, bubble.bottom);
        ctx.lineTo(nextBubble.right, bubble.bottom);
        ctx.lineTo(nextBubble.right, nextBubble.top);
        ctx.lineTo(bubble.right - backgroundRounded, nextBubble.top);
      } else {
        ctx.arc(bubble.right - backgroundRounded, bubble.bottom - backgroundRounded, backgroundRounded, 0, Math.PI / 2);
        if (nextBubble) {
          ctx.lineTo(nextBubble.right - backgroundRounded, bubble.bottom);
        } else {
          ctx.lineTo(bubble.left + backgroundRounded, bubble.bottom);
        }
      }

      // Bottom-left corner
      if (nextBubble && bubble.left < nextBubble.left) {
        const curveSize = Math.min(backgroundRounded, (nextBubble.left - bubble.left) / 2);
        ctx.quadraticCurveTo(bubble.left, bubble.bottom, bubble.left, bubble.bottom - curveSize);
        ctx.lineTo(bubble.left, bubble.top + backgroundRounded);
      } else {
        ctx.arc(bubble.left + backgroundRounded, bubble.bottom - backgroundRounded, backgroundRounded, Math.PI / 2, Math.PI);
        ctx.lineTo(bubble.left, bubble.top + backgroundRounded);
      }

      // Back to start
      ctx.arc(bubble.left + backgroundRounded, bubble.top + backgroundRounded, backgroundRounded, Math.PI, -Math.PI / 2);
      
      ctx.closePath();
      ctx.fill();
    }

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

