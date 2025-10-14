# SVG Export for MassUGC Studio

This tool exports React components as scalable SVG assets for website use.

## Quick Start

```bash
npm run export:svg
```

This command will:
1. Generate SVG files from React components
2. Optimize them with SVGO for web performance
3. Save them to `src/renderer/public/svgs/`

## Generated Files

- `campaigns-hero.svg` - Main campaigns dashboard view
- `jobs-queue.svg` - Running campaigns/job queue view  
- `settings-panel.svg` - Settings configuration panel

## Using SVGs on Website

### Inline SVG (Recommended)
```html
<!-- Copy SVG content directly into HTML -->
<div class="hero-section">
  <!-- Paste SVG content here -->
</div>
```

### As Image
```html
<img src="path/to/campaigns-hero.svg" alt="MassUGC Studio Dashboard" />
```

### CSS Background
```css
.hero-bg {
  background-image: url('path/to/campaigns-hero.svg');
  background-size: cover;
}
```

## Regenerating Assets

Run `npm run export:svg` whenever you want to update the SVG assets with latest UI changes.
