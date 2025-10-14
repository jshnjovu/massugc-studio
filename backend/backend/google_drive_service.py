"""
Google Drive Service for MassUGC Studio
Handles OAuth, file uploads, and folder management
"""

import os
import json
import pickle
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleDriveService:
    """Service for managing Google Drive integration"""
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    REDIRECT_URI = 'http://localhost:2026/api/drive/callback'
    MAIN_FOLDER_NAME = 'MassUGC Studio Videos'
    
    # Embedded OAuth credentials (public client - safe to embed)
    OAUTH_CONFIG = {
        "web": {
            "client_id": "224312687747-5ga0d8916f1t3pi1nonvg6i6d26od9hq.apps.googleusercontent.com",
            "client_secret": "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",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:2026/api/drive/callback"]
        }
    }
    
    def __init__(self, credentials_file: str = None):
        """Initialize Google Drive service

        Args:
            credentials_file: Path to OAuth2 credentials JSON file
        """
        self.credentials_file = credentials_file or os.path.join(
            os.path.dirname(__file__), 'credentials.json'
        )

        # Store token in user-specific directory, NOT in the app bundle
        # This prevents credentials from being packaged with the app
        user_data_dir = self._get_user_data_directory()
        self.token_file = os.path.join(user_data_dir, 'google_drive_token.pickle')
        logger.info(f"Google Drive token storage location: {self.token_file}")

        self.creds: Optional[Credentials] = None
        self.service = None
        self.main_folder_id = None
        self._load_credentials()

    def _get_user_data_directory(self) -> str:
        """Get user-specific data directory for storing credentials

        Returns:
            Path to user data directory
        """
        import platform
        system = platform.system()

        if system == 'Darwin':  # macOS
            base_dir = os.path.expanduser('~/Library/Application Support/MassUGC Studio')
        elif system == 'Windows':
            base_dir = os.path.expandvars(r'%APPDATA%\MassUGC Studio')
        else:  # Linux and others
            base_dir = os.path.expanduser('~/.config/massugc-studio')

        # Create directory if it doesn't exist
        os.makedirs(base_dir, exist_ok=True)
        return base_dir

    def _load_credentials(self):
        """Load existing credentials from token file"""
        if os.path.exists(self.token_file):
            try:
                with open(self.token_file, 'rb') as token:
                    self.creds = pickle.load(token)
                    if self.creds and self.creds.valid:
                        self.service = build('drive', 'v3', credentials=self.creds)
                        self._ensure_main_folder()
            except Exception as e:
                logger.error(f"Error loading credentials: {e}")
                self.creds = None
    
    def _save_credentials(self):
        """Save credentials to token file"""
        try:
            with open(self.token_file, 'wb') as token:
                pickle.dump(self.creds, token)
        except Exception as e:
            logger.error(f"Error saving credentials: {e}")
    
    def get_authorization_url(self) -> str:
        """Get OAuth2 authorization URL
        
        Returns:
            Authorization URL for user to grant permissions
        """
        # Try to use credentials file first, fall back to embedded config
        if os.path.exists(self.credentials_file):
            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=self.SCOPES,
                redirect_uri=self.REDIRECT_URI
            )
        else:
            # Use embedded credentials
            flow = Flow.from_client_config(
                self.OAUTH_CONFIG,
                scopes=self.SCOPES,
                redirect_uri=self.REDIRECT_URI
            )
        
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        return authorization_url
    
    def handle_oauth_callback(self, authorization_code: str) -> bool:
        """Handle OAuth2 callback with authorization code
        
        Args:
            authorization_code: Code from OAuth callback
            
        Returns:
            True if authentication successful
        """
        try:
            # Try to use credentials file first, fall back to embedded config
            if os.path.exists(self.credentials_file):
                flow = Flow.from_client_secrets_file(
                    self.credentials_file,
                    scopes=self.SCOPES,
                    redirect_uri=self.REDIRECT_URI
                )
            else:
                flow = Flow.from_client_config(
                    self.OAUTH_CONFIG,
                    scopes=self.SCOPES,
                    redirect_uri=self.REDIRECT_URI
                )
            
            flow.fetch_token(code=authorization_code)
            self.creds = flow.credentials
            self._save_credentials()
            
            self.service = build('drive', 'v3', credentials=self.creds)
            self._ensure_main_folder()
            
            return True
        except Exception as e:
            logger.error(f"OAuth callback error: {e}")
            return False
    
    def refresh_token(self) -> bool:
        """Refresh expired credentials
        
        Returns:
            True if refresh successful
        """
        if not self.creds or not self.creds.refresh_token:
            return False
        
        try:
            self.creds.refresh(Request())
            self._save_credentials()
            self.service = build('drive', 'v3', credentials=self.creds)
            return True
        except Exception as e:
            logger.error(f"Token refresh error: {e}")
            return False
    
    def is_connected(self) -> bool:
        """Check if Drive is connected and authenticated
        
        Returns:
            True if connected
        """
        if not self.creds:
            return False
        
        if self.creds.expired and self.creds.refresh_token:
            return self.refresh_token()
        
        return self.creds.valid
    
    def disconnect(self):
        """Disconnect Google Drive (revoke token)"""
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
        self.creds = None
        self.service = None
        self.main_folder_id = None
    
    def get_user_info(self) -> Optional[Dict[str, Any]]:
        """Get connected user information
        
        Returns:
            User info dict or None
        """
        if not self.is_connected():
            return None
        
        try:
            about = self.service.about().get(fields="user").execute()
            return {
                'email': about['user']['emailAddress'],
                'name': about['user'].get('displayName', ''),
                'photo': about['user'].get('photoLink', '')
            }
        except Exception as e:
            logger.error(f"Error getting user info: {e}")
            return None
    
    def _ensure_main_folder(self):
        """Ensure main MassUGC folder exists in Drive root"""
        if not self.service:
            return
        
        try:
            # Search for existing folder
            results = self.service.files().list(
                q=f"name='{self.MAIN_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                spaces='drive',
                fields='files(id, name)'
            ).execute()
            
            items = results.get('files', [])
            
            if items:
                self.main_folder_id = items[0]['id']
            else:
                # Create main folder
                folder_metadata = {
                    'name': self.MAIN_FOLDER_NAME,
                    'mimeType': 'application/vnd.google-apps.folder'
                }
                folder = self.service.files().create(
                    body=folder_metadata,
                    fields='id'
                ).execute()
                self.main_folder_id = folder['id']
                
        except Exception as e:
            logger.error(f"Error ensuring main folder: {e}")
    
    def _get_or_create_folder(self, name: str, parent_id: str) -> str:
        """Get or create a folder in Drive
        
        Args:
            name: Folder name
            parent_id: Parent folder ID
            
        Returns:
            Folder ID
        """
        if not self.service:
            raise RuntimeError("Drive service not initialized")
        
        # Search for existing folder
        query = f"name='{name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        
        try:
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id)'
            ).execute()
            
            items = results.get('files', [])
            
            if items:
                return items[0]['id']
            
            # Create folder
            folder_metadata = {
                'name': name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }
            
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            
            return folder['id']
            
        except Exception as e:
            logger.error(f"Error creating folder {name}: {e}")
            raise
    
    def upload_video(self, file_path: str, date_folder: str, product_folder: str, 
                    job_name: str) -> Optional[Dict[str, str]]:
        """Upload video to Google Drive with folder structure
        
        Args:
            file_path: Local path to video file
            date_folder: Date folder name (YYYY-MM-DD)
            product_folder: Product folder name
            job_name: Job name for the file
            
        Returns:
            Dict with file_id and web_link, or None on error
        """
        if not self.is_connected():
            logger.error("Drive not connected")
            return None
        
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return None
        
        try:
            # Create folder structure
            date_folder_id = self._get_or_create_folder(
                date_folder, 
                self.main_folder_id
            )
            product_folder_id = self._get_or_create_folder(
                product_folder,
                date_folder_id
            )
            
            # Prepare file metadata
            file_name = os.path.basename(file_path)
            file_metadata = {
                'name': file_name,
                'parents': [product_folder_id]
            }
            
            # Upload file
            media = MediaFileUpload(
                file_path,
                mimetype='video/mp4',
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink, webContentLink'
            ).execute()
            
            # Delete local file after successful upload
            try:
                os.remove(file_path)
                logger.info(f"Deleted local file: {file_path}")
            except Exception as e:
                logger.warning(f"Could not delete local file: {e}")
            
            return {
                'file_id': file['id'],
                'web_link': file.get('webViewLink', ''),
                'download_link': file.get('webContentLink', ''),
                'drive_path': f"{self.MAIN_FOLDER_NAME}/{date_folder}/{product_folder}/{file_name}"
            }
            
        except HttpError as e:
            logger.error(f"HTTP error uploading video: {e}")
            return None
        except Exception as e:
            logger.error(f"Error uploading video: {e}")
            return None
    
    def get_folder_contents(self, folder_path: str = None) -> List[Dict[str, Any]]:
        """Get contents of a Drive folder
        
        Args:
            folder_path: Path like "2024-01-15/Product_Name"
            
        Returns:
            List of file/folder information
        """
        if not self.is_connected():
            return []
        
        try:
            folder_id = self.main_folder_id
            
            if folder_path:
                # Navigate to specified folder
                parts = folder_path.split('/')
                for part in parts:
                    folder_id = self._get_or_create_folder(part, folder_id)
            
            # List contents
            results = self.service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                spaces='drive',
                fields='files(id, name, mimeType, size, modifiedTime, webViewLink)',
                orderBy='folder,name'
            ).execute()
            
            return results.get('files', [])
            
        except Exception as e:
            logger.error(f"Error getting folder contents: {e}")
            return []