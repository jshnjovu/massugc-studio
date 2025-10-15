import React, { useEffect, useRef, useCallback } from 'react';

/**
 * ConnectedTextBackground Component
 * Canvas 2D implementation of TikTok/CapCut speech bubble effect with proper inward curves
 */

const ConnectedTextBackground = ({
  text = '',
  backgroundColor = '#000000',
  backgroundOpacity = 100,
  backgroundRounded = 15,
  padding = 20,
  backgroundHeight = 50,
  backgroundWidth = 50,
  lineSpacing = 0,
  fontSize = 24,
  actualFontSize = null,  // Actual video font size for export
  style = {},
  onExport = null  // New prop for export callback
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const textLines = text.split('\n').filter(line => line.trim() !== '');
  
  // Memoized drawing function
  const drawConnectedBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textLines.length) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set font for text measurement (before measuring!)
    const fontWeight = style.fontWeight || 'normal';
    const fontStyle = style.fontStyle || 'normal';
    const fontFamily = style.fontFamily || 'System';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Measure all text lines
    const measurements = textLines.map(line => ({
      text: line,
      width: ctx.measureText(line).width,
      height: fontSize // Use actual font size, not multiplied
    }));

    // Calculate all sizing values
    const basePaddingV = fontSize * 0.3;
    const basePaddingH = fontSize * 0.4;
    const verticalPadding = (basePaddingV * backgroundHeight) / 50;
    const horizontalPadding = (basePaddingH * backgroundWidth) / 50;
    const maxWidth = Math.max(...measurements.map(m => m.width));
    const maxBubbleWidth = maxWidth + (horizontalPadding * 2);
    const bubbleHeight = fontSize + (verticalPadding * 2);
    const totalHeight = measurements.length * bubbleHeight;
    const canvasWidth = maxBubbleWidth + 20;
    const canvasHeight = totalHeight;

    // Calculate line spacing based on lineSpacing prop
    const baseLineHeight = fontSize * 1.5; // Base spacing between lines
    const spacingAdjustment = (lineSpacing / 10) * fontSize; // Convert slider to pixel adjustment
    const textLineSpacing = baseLineHeight + spacingAdjustment; // Allow negative spacing for tighter text

    // Only log during export to reduce spam
    if (window.DEBUG_BACKGROUNDS) {
      console.log(`[DEBUG] Connected Background [${text}]: ${Math.round(canvasWidth)}x${Math.round(canvasHeight)}px, font=${fontSize}px`);
    }

    // Set canvas size with device pixel ratio
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    // Scale context for high DPI displays
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Re-set font after scaling
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    
    // PROFESSIONAL RULES-BASED ALGORITHM
    // Rule 1: Each line gets its own rectangular bubble
    // Rule 2: Inward curves ONLY when next line is narrower
    // Rule 3: Simple geometry - only straight lines and quarter-circles
    
    // Allow full rounding regardless of padding
    const outerRadius = backgroundRounded;
    const innerRadius = outerRadius; // Use same radius for all corners (consistent rounding)
    
    // Create individual bubble rectangles for each line
    const bubbles = [];
    
    // Bubbles stack normally
    for (let i = 0; i < measurements.length; i++) {
      const line = measurements[i];
      // Use consistent horizontal padding for all lines
      const bubbleWidth = line.width + (horizontalPadding * 2);
      
      // Stack bubbles directly on top of each other
      const bubbleTop = i * bubbleHeight;
      const bubbleBottom = bubbleTop + bubbleHeight;
      
      bubbles.push({
        left: (canvasWidth - bubbleWidth) / 2,
        right: (canvasWidth - bubbleWidth) / 2 + bubbleWidth,
        top: bubbleTop,
        bottom: bubbleBottom,
        width: bubbleWidth,
        textWidth: line.width,
        text: line.text
      });
    }
    
    // Calculate text positions separately with adjustable spacing
    const textBlockHeight = fontSize + ((measurements.length - 1) * textLineSpacing);
    const textStartY = (totalHeight - textBlockHeight) / 2 + fontSize / 2;
    const textPositions = [];
    for (let i = 0; i < measurements.length; i++) {
      textPositions.push(textStartY + (i * textLineSpacing));
    }
    
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
    
    ctx.closePath();
    
    // Fill background with color and opacity
    const opacity = backgroundOpacity / 100;
    const r = parseInt(backgroundColor.substring(1, 3), 16);
    const g = parseInt(backgroundColor.substring(3, 5), 16);
    const b = parseInt(backgroundColor.substring(5, 7), 16);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.fill();
    
    // Draw text on top
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = style.color || '#FFFFFF';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    
    // Apply text stroke if specified
    if (style.WebkitTextStroke && style.WebkitTextStroke !== 'none') {
      const strokeMatch = style.WebkitTextStroke.match(/(\d+)px\s+(.+)/);
      if (strokeMatch) {
        ctx.strokeStyle = strokeMatch[2];
        ctx.lineWidth = parseInt(strokeMatch[1]);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
      }
    }
    
    // Render text in each bubble
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    // Render text with adjustable spacing
    for (let i = 0; i < measurements.length; i++) {
      const line = measurements[i];
      const x = canvasWidth / 2; // Center horizontally on canvas
      // Use pre-calculated text positions
      const y = textPositions[i];
      
      // Draw stroke first if specified
      if (style.WebkitTextStroke && style.WebkitTextStroke !== 'none') {
        ctx.strokeText(line.text, x, y);
      }
      
      // Draw fill text
      ctx.fillText(line.text, x, y);
    }
    
  }, [textLines, backgroundColor, backgroundOpacity, backgroundRounded, padding, backgroundHeight, backgroundWidth, lineSpacing, fontSize, actualFontSize, style]);
  
  // Export functions for video processing pipeline
  const exportOptimizedBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textLines.length) return null;
    
    // Use optimal compression for speed and smaller file sizes
    return canvas.toDataURL('image/png', 0.8); // 80% quality for smaller files
  }, [textLines]);

  const getBackgroundMetadata = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textLines.length) return null;

    const dpr = window.devicePixelRatio || 1;

    // ZOOM-INDEPENDENT EXPORT CALCULATION
    // Calculate export size based purely on actual font size, ignoring zoom/preview state
    const exportFontSize = actualFontSize || 20; // Use actual font size for final video

    // Create a temporary canvas context for accurate text measurements at export size
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const fontWeight = style.fontWeight || 'normal';
    const fontStyle = style.fontStyle || 'normal';
    const fontFamily = style.fontFamily || 'System';
    tempCtx.font = `${fontStyle} ${fontWeight} ${exportFontSize}px ${fontFamily}`;

    // Measure text at actual export font size
    const exportMeasurements = textLines.map(line => ({
      text: line,
      width: tempCtx.measureText(line).width,
      height: exportFontSize
    }));

    // Calculate padding at export size
    const exportBasePaddingV = exportFontSize * 0.3;
    const exportBasePaddingH = exportFontSize * 0.4;
    const exportVerticalPadding = (exportBasePaddingV * backgroundHeight) / 50;
    const exportHorizontalPadding = (exportBasePaddingH * backgroundWidth) / 50;

    // Calculate export canvas dimensions
    const exportMaxWidth = Math.max(...exportMeasurements.map(m => m.width));
    const exportMaxBubbleWidth = exportMaxWidth + (exportHorizontalPadding * 2);
    const exportBubbleHeight = exportFontSize + (exportVerticalPadding * 2);
    const exportTotalHeight = exportMeasurements.length * exportBubbleHeight;
    const exportCanvasWidth = exportMaxBubbleWidth + 20;
    const exportCanvasHeight = exportTotalHeight;

    // Calculate export text positions
    const exportBaseLineHeight = exportFontSize * 1.5;
    const exportSpacingAdjustment = (lineSpacing / 10) * exportFontSize;
    const exportTextLineSpacing = exportBaseLineHeight + exportSpacingAdjustment;
    const exportTextBlockHeight = exportFontSize + ((exportMeasurements.length - 1) * exportTextLineSpacing);
    const exportTextStartY = (exportTotalHeight - exportTextBlockHeight) / 2 + exportFontSize / 2;

    const exportTextPositions = [];
    for (let i = 0; i < exportMeasurements.length; i++) {
      exportTextPositions.push(exportTextStartY + (i * exportTextLineSpacing));
    }

    // Calculate export bubble positions
    const exportBubbles = [];
    for (let i = 0; i < exportMeasurements.length; i++) {
      const line = exportMeasurements[i];
      const bubbleWidth = line.width + (exportHorizontalPadding * 2);
      const bubbleTop = i * exportBubbleHeight;
      const bubbleBottom = bubbleTop + exportBubbleHeight;

      exportBubbles.push({
        left: (exportCanvasWidth - bubbleWidth) / 2,
        right: (exportCanvasWidth - bubbleWidth) / 2 + bubbleWidth,
        top: bubbleTop,
        bottom: bubbleBottom,
        width: bubbleWidth,
        textWidth: line.width,
        text: line.text
      });
    }

    const exportData = {
      // Canvas dimensions at final video size (no DPR scaling needed)
      width: Math.round(exportCanvasWidth),
      height: Math.round(exportCanvasHeight),
      devicePixelRatio: dpr,

      // Text positioning data at final video size
      textPositions: exportTextPositions.map(pos => Math.round(pos)),
      bubblePositions: exportBubbles.map(bubble => ({
        left: Math.round(bubble.left),
        right: Math.round(bubble.right),
        top: Math.round(bubble.top),
        bottom: Math.round(bubble.bottom),
        width: Math.round(bubble.width),
        textWidth: Math.round(bubble.textWidth),
        text: bubble.text
      })),

      // Text center position for video overlay
      textX: Math.round(exportCanvasWidth / 2),
      textY: Math.round(exportTextPositions[0] || 0),

      // Background bounds for FFmpeg positioning
      backgroundX: 0,
      backgroundY: 0,
      backgroundWidth: Math.round(exportCanvasWidth),
      backgroundHeight: Math.round(exportCanvasHeight)
    };

    // Only log during debugging
    if (window.DEBUG_BACKGROUNDS) {
      console.log(`📦 Export: ${exportData.backgroundWidth}x${exportData.backgroundHeight}px, font=${exportFontSize}px`);
    }

    return exportData;
  }, [textLines, backgroundColor, backgroundOpacity, backgroundRounded, padding, backgroundHeight, backgroundWidth, lineSpacing, fontSize, actualFontSize, style]);

  const exportForVideo = useCallback(() => {
    if (!textLines.length) return null;
    
    const imageData = exportOptimizedBackground();
    const metadata = getBackgroundMetadata();
    
    if (!imageData || !metadata) return null;
    
    return {
      image: imageData,
      metadata: metadata
    };
  }, [exportOptimizedBackground, getBackgroundMetadata, textLines]);
  
  // Note: Removed the "unchanged data" check from export logic below
  // It was preventing legitimate updates when duplicating campaigns with same text

  // Redraw canvas when dependencies change
  useEffect(() => {
    drawConnectedBackground();
  }, [drawConnectedBackground]);
  
  // Call export callback when export data is ready (debounced)
  useEffect(() => {
    if (onExport && textLines.length > 0) {
      // Debounce the export to prevent infinite loops
      const timeoutId = setTimeout(() => {
        const exportData = exportForVideo();
        if (exportData) {
          // Always call onExport when we have valid data (debouncing prevents loops)
          onExport(exportData);
        }
      }, 300); // 300ms delay to prevent rapid re-exports
      
      return () => clearTimeout(timeoutId);
    }
  }, [textLines, backgroundColor, backgroundOpacity, backgroundRounded, backgroundHeight, backgroundWidth, lineSpacing, fontSize, actualFontSize]); // Remove onExport and exportForVideo from dependencies
  
  if (!textLines.length) {
    return null;
  }
  
  return (
    <div ref={containerRef} style={{ 
      display: 'inline-block', 
      position: 'relative',
      textAlign: style.textAlign || 'center',
      textTransform: style.textTransform || 'none',
      letterSpacing: style.letterSpacing || '0px',
      lineHeight: style.lineHeight || '100%',
      textDecoration: style.textDecoration || 'none'
    }}>
      <canvas 
        ref={canvasRef}
        style={{ 
          display: 'block'
        }}
      />
    </div>
  );
};

export default ConnectedTextBackground;