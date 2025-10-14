# Google Drive OAuth Setup Instructions

## Setting up Google Drive OAuth for MassUGC Studio

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing one

2. **Enable Google Drive API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on it and press "Enable"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - If prompted, configure OAuth consent screen first:
     - Choose "External" for user type
     - Fill in app name: "MassUGC Studio"
     - Add your email as support email
     - Add authorized domains if needed
     - Add scopes: `https://www.googleapis.com/auth/drive.file`
   
4. **Configure OAuth Client**
   - Application type: "Web application"
   - Name: "MassUGC Studio"
   - Authorized redirect URIs: 
     - `http://localhost:2026/api/drive/callback`
   - Click "Create"

5. **Download Credentials**
   - Download the JSON file
   - Rename it to `credentials.json`
   - Place it in `/massugc-video-service/backend/credentials.json`

## Important Notes

- The `credentials.json` file contains sensitive data - never commit to Git
- The `.gitignore` already excludes this file
- Users will authenticate through their browser
- Tokens are stored locally in `token.pickle`

## Testing

1. Start the backend server
2. In the frontend, click "Connect Google Drive"
3. Browser will open for authentication
4. After approval, videos will upload to Drive when enabled