# MassUGC Studio

![Build Status](https://github.com/YOUR_ORG/MassUGC-Studio/actions/workflows/build-and-deploy.yml/badge.svg)
![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)

MassUGC Studio is a high-performance desktop application designed for businesses to generate AI videos at scale. This cross-platform app allows for the creation of 300+ videos per day with just a few clicks.

## Features

- **Campaign Management**: Create and manage video campaigns
- **Avatar Selection**: Choose from a variety of AI avatars in multiple languages
- **Script Management**: Upload and manage your script templates
- **Video Export**: Batch export videos in various formats
- **Intuitive UI**: Apple-inspired design for maximum usability

## CI/CD Pipeline

MassUGC Studio uses GitHub Actions for automated building, testing, and deployment across Windows and macOS platforms.

### Quick Links

- 📚 **[Architecture Documentation](docs/cicd-architecture.md)** - Complete technical architecture
- 🚀 **[Quick Start Guide](docs/CICD_QUICKSTART.md)** - Get started in 10 minutes
- 📋 **[Implementation Summary](docs/CICD_IMPLEMENTATION_SUMMARY.md)** - Roadmap and checklists
- 📊 **[GitHub Actions Overview](GITHUB_ACTIONS_OVERVIEW.md)** - What's delivered

### Workflow Features

- ✅ Multi-platform builds (Windows + macOS)
- ✅ Backend integration (ZyraVideoAgentBackend)
- ✅ Automated testing with Jest (80% coverage threshold)
- ✅ Code signing & notarization (macOS)
- ✅ Canary deployment with manual approval gates
- ✅ Production deployment with 2-reviewer approval

### Getting Started with CI/CD

1. **Push to main branch** - Workflow runs automatically
2. **Configure environments** - Settings → Environments (canary, production)
3. **Add secrets** (macOS only) - APPLE_ID, APPLE_APP_PASSWORD, APPLE_TEAM_ID
4. **Watch builds** - Actions tab shows real-time progress

See [CICD_QUICKSTART.md](docs/CICD_QUICKSTART.md) for detailed setup instructions.

## Development

This is an Electron-based application using React and Tailwind CSS.

### Prerequisites

- Node.js (16.x or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Running the app

```bash
npm start
```

This will start the development server and open the Electron app.

### Building the app

```bash
npm run build
```

This will create a distributable package in the `release` folder.

## Project Structure

```
├── src/
│   ├── main/           # Electron main process code
│   └── renderer/       # React frontend code
│       ├── public/     # Static assets
│       └── src/        # React components and pages
│           ├── components/  # Reusable UI components
│           └── pages/       # Application pages
├── package.json        # Project configuration
└── README.md           # Project documentation
```

## Current Status

This is a demonstration prototype with mocked functionality. The UI is fully interactive, but backend API integrations will be implemented in future versions.

## License

All rights reserved. 