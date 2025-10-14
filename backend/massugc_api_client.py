"""
MassUGC API Client with Device Fingerprinting
Implements the complete API integration as specified in the integration guide.
"""

import os
import json
import hashlib
import base64
import platform
import socket
import time
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

class DeviceFingerprintGenerator:
    """Generates unique device fingerprints for API authentication"""
    
    def __init__(self):
        self._cached_fingerprint = None
        self._machine_id = None
    
    def _get_machine_id(self) -> str:
        """Get a unique machine identifier"""
        if self._machine_id:
            return self._machine_id
            
        try:
            # Try to get a unique machine identifier
            import uuid
            
            # Use MAC address as base for machine ID
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            
            # Combine with hostname for uniqueness
            hostname = socket.gethostname()
            
            # Create stable machine ID
            machine_string = f"{mac}-{hostname}-{platform.machine()}"
            self._machine_id = hashlib.sha256(machine_string.encode()).hexdigest()[:32]
            
        except Exception as e:
            logger.warning(f"Failed to generate machine ID: {e}")
            # Fallback to hostname + platform
            fallback = f"{socket.gethostname()}-{platform.platform()}"
            self._machine_id = hashlib.sha256(fallback.encode()).hexdigest()[:32]
        
        return self._machine_id
    
    def generate_fingerprint(self) -> str:
        """Generate device fingerprint for API authentication"""
        if self._cached_fingerprint:
            return self._cached_fingerprint
        
        try:
            fingerprint_data = {
                'machineId': self._get_machine_id(),
                'platform': platform.system(),
                'arch': platform.machine(),
                'hostname': socket.gethostname(),
                'appVersion': '1.0.20',
                'timestamp': int(time.time())
            }
            
            # Create deterministic hash
            fingerprint_string = json.dumps(fingerprint_data, sort_keys=True)
            fingerprint_hash = hashlib.sha256(fingerprint_string.encode()).hexdigest()
            
            # Create the final fingerprint object
            final_fingerprint = {
                'hash': fingerprint_hash,
                'platform': fingerprint_data['platform'],
                'appVersion': fingerprint_data['appVersion']
            }
            
            # Base64 encode the fingerprint
            self._cached_fingerprint = base64.b64encode(
                json.dumps(final_fingerprint).encode()
            ).decode()
            
            logger.debug(f"Generated device fingerprint: {self._cached_fingerprint[:20]}...")
            return self._cached_fingerprint
            
        except Exception as e:
            logger.error(f"Failed to generate device fingerprint: {e}")
            # Create a basic fallback fingerprint
            fallback = {
                'hash': hashlib.sha256(f"{socket.gethostname()}-{platform.system()}".encode()).hexdigest(),
                'platform': platform.system(),
                'appVersion': '1.0.20'
            }
            self._cached_fingerprint = base64.b64encode(json.dumps(fallback).encode()).decode()
            return self._cached_fingerprint


class MassUGCApiError(Exception):
    """Base exception for MassUGC API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, error_code: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class MassUGCApiClient:
    """
    Complete MassUGC API client with device fingerprinting and secure authentication
    """
    
    # Error codes as defined in the integration guide
    ERROR_CODES = {
        'INVALID_API_KEY': 'invalid_api_key',
        'API_KEY_INACTIVE': 'api_key_inactive', 
        'API_KEY_EXPIRED': 'api_key_expired',
        'RATE_LIMIT_EXCEEDED': 'rate_limit_exceeded',
        'INSUFFICIENT_CREDITS': 'insufficient_credits',
        'DEVICE_MISMATCH': 'device_mismatch',
        'VALIDATION_ERROR': 'validation_error',
        'SERVER_ERROR': 'server_error'
    }
    
    def __init__(self, api_key: str, base_url: str = 'https://massugc-cloud-api.onrender.com'):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.device_fingerprint_generator = DeviceFingerprintGenerator()
        self.device_fingerprint = None
        self.session = requests.Session()
        self.user_info = None
        self.rate_limit_info = None
        
        # Validate API key format
        if not self._validate_api_key_format(api_key):
            raise MassUGCApiError("Invalid API key format. Expected: massugc_[32-character-nanoid]")
    
    def _validate_api_key_format(self, key: str) -> bool:
        """Validate API key format according to spec"""
        if not key or not isinstance(key, str):
            return False
        
        # Check format: massugc_[32-chars]
        import re
        pattern = r'^massugc_[A-Za-z0-9_-]{32}$'
        return bool(re.match(pattern, key))
    
    def initialize(self) -> Dict[str, Any]:
        """Initialize the API client and validate connection"""
        try:
            self.device_fingerprint = self.device_fingerprint_generator.generate_fingerprint()
            validation_result = self.validate_connection()
            logger.info(f"MassUGC API client initialized successfully for user: {validation_result.get('user', {}).get('email', 'unknown')}")
            return validation_result
        except Exception as e:
            logger.error(f"Failed to initialize MassUGC API client: {e}")
            raise MassUGCApiError(f"Failed to initialize API client: {str(e)}")
    
    def _create_headers(self, include_device_fingerprint: bool = True) -> Dict[str, str]:
        """Create headers for API requests"""
        headers = {
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json',
            'User-Agent': f'MassUGC-Desktop/1.0.20 ({platform.system()})'
        }
        
        if include_device_fingerprint and self.device_fingerprint:
            headers['X-Device-Fingerprint'] = self.device_fingerprint
        
        return headers
    
    def _handle_api_error(self, response: requests.Response) -> None:
        """Handle API response errors according to the integration guide"""
        status_code = response.status_code
        
        # Debug logging to see what's actually happening
        logger.error(f"API Error - Status: {status_code}, URL: {response.url}")
        logger.error(f"Response headers: {dict(response.headers)}")
        logger.error(f"Response text: {response.text[:500]}...")
        
        try:
            error_data = response.json()
            # Backend returns: {"error": "error_code", "message": "human readable"}
            error_code = error_data.get('error', 'unknown_error')
            error_message = error_data.get('message', error_data.get('error', 'Unknown error'))
        except:
            error_code = 'unknown_error'
            error_message = response.text or f'HTTP {status_code} error'
        
        if status_code == 401:
            raise MassUGCApiError(
                "Invalid or expired API key. Please check your key in settings.",
                status_code=status_code,
                error_code=self.ERROR_CODES['INVALID_API_KEY']
            )
        
        elif status_code == 403:
            if error_code == 'device_mismatch':
                raise MassUGCApiError(
                    "This API key is already in use on another device.",
                    status_code=status_code,
                    error_code=self.ERROR_CODES['DEVICE_MISMATCH']
                )
            elif error_code == 'insufficient_credits':
                raise MassUGCApiError(
                    "Insufficient credits or Pro subscription required.",
                    status_code=status_code,
                    error_code=self.ERROR_CODES['INSUFFICIENT_CREDITS']
                )
            else:
                raise MassUGCApiError(
                    error_message,
                    status_code=status_code,
                    error_code=self.ERROR_CODES['INSUFFICIENT_CREDITS']
                )
        
        elif status_code == 429:
            raise MassUGCApiError(
                "Rate limit exceeded. Please wait before trying again.",
                status_code=status_code,
                error_code=self.ERROR_CODES['RATE_LIMIT_EXCEEDED']
            )
        
        elif status_code >= 500:
            raise MassUGCApiError(
                "Server error. Please try again later.",
                status_code=status_code,
                error_code=self.ERROR_CODES['SERVER_ERROR']
            )
        
        else:
            raise MassUGCApiError(
                error_message,
                status_code=status_code,
                error_code=self.ERROR_CODES['VALIDATION_ERROR']
            )
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make HTTP request with proper error handling and retries"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = kwargs.pop('headers', {})
        headers.update(self._create_headers())
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    timeout=30,
                    **kwargs
                )
                
                # Update rate limit info if available
                self._update_rate_limit_info(response)
                
                # Handle errors
                if not response.ok:
                    if response.status_code >= 500 and attempt < max_retries - 1:
                        # Retry server errors with exponential backoff
                        time.sleep(2 ** attempt)
                        continue
                    self._handle_api_error(response)
                
                return response
                
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise MassUGCApiError(f"Network error: {str(e)}")
        
        raise MassUGCApiError("Max retries exceeded")
    
    def _update_rate_limit_info(self, response: requests.Response) -> None:
        """Update rate limit information from response headers"""
        try:
            # Check for standard rate limiting headers first
            limit_header = response.headers.get('X-RateLimit-Limit')
            remaining_header = response.headers.get('X-RateLimit-Remaining')
            reset_header = response.headers.get('X-RateLimit-Reset')
            
            # Check for MassUGC custom rate limiting headers (per-minute)
            custom_limit_header = response.headers.get('X-RateLimit-Limit-Minute')
            custom_remaining_header = response.headers.get('X-RateLimit-Remaining-Minute')
            
            # Also check hourly limits for additional info
            hourly_limit_header = response.headers.get('X-RateLimit-Limit-Hour')
            hourly_remaining_header = response.headers.get('X-RateLimit-Remaining-Hour')
            
            if limit_header is not None and remaining_header is not None:
                # Standard headers are present
                self.rate_limit_info = {
                    'limit': int(limit_header),
                    'remaining': int(remaining_header),
                    'reset_time': reset_header,
                    'type': 'standard'
                }
            elif custom_limit_header is not None and custom_remaining_header is not None:
                # MassUGC custom headers are present - use per-minute limits
                self.rate_limit_info = {
                    'limit': int(custom_limit_header),
                    'remaining': int(custom_remaining_header),
                    'reset_time': None,  # Custom headers don't include reset time
                    'type': 'massugc-minute',
                    'hourly_limit': int(hourly_limit_header) if hourly_limit_header else None,
                    'hourly_remaining': int(hourly_remaining_header) if hourly_remaining_header else None
                }
            else:
                # No rate limiting headers found - this is OK for endpoints that don't have rate limiting
                logger.debug("No rate limiting headers found in API response (this is normal for some endpoints)")
                # Don't set rate_limit_info to None - keep the previous value if any
                # This prevents disrupting API calls to endpoints without rate limiting
                return
            
            # Log rate limit status only when it's getting low or for debugging
            if self.rate_limit_info and self.rate_limit_info.get('remaining') is not None:
                if self.rate_limit_info['remaining'] < 5:
                    logger.warning(f"Rate limit nearly exceeded: {self.rate_limit_info['remaining']}/{self.rate_limit_info['limit']} remaining ({self.rate_limit_info['type']})")
                elif self.rate_limit_info['remaining'] < 10:
                    logger.info(f"Rate limit getting low: {self.rate_limit_info['remaining']}/{self.rate_limit_info['limit']} remaining ({self.rate_limit_info['type']})")
                else:
                    # Only log at debug level for normal rate limit status to reduce noise
                    logger.debug(f"Rate limit status: {self.rate_limit_info['remaining']}/{self.rate_limit_info['limit']} remaining ({self.rate_limit_info['type']})")
                
        except (ValueError, TypeError) as e:
            logger.debug(f"Error parsing rate limit headers: {e}")
            # Don't set to None on error - just skip updating
    
    def validate_connection(self) -> Dict[str, Any]:
        """Validate API key and get user information"""
        try:
            response = self._make_request('POST', 'validate')
            result = response.json()
            
            # Extract user info from the 'data' field as per API documentation
            data = result.get('data', {})
            self.user_info = {
                'user_id': data.get('user_id'),
                'email': data.get('email'),
                'subscription_tier': data.get('subscription_tier'),
                'remaining_quota': data.get('remaining_quota')
            }
            logger.info(f"API connection validated for user: {self.user_info.get('email', 'unknown')}")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to validate API connection: {e}")
            raise MassUGCApiError(f"Failed to validate API connection: {str(e)}")
    
    def generate_video(self, audio_file_path: str, image_file_path: str, options: Optional[Dict] = None) -> Dict[str, Any]:
        """Generate lip-sync video using the MassUGC API"""
        try:
            if not os.path.exists(audio_file_path):
                raise MassUGCApiError(f"Audio file not found: {audio_file_path}")
            
            if not os.path.exists(image_file_path):
                raise MassUGCApiError(f"Image file not found: {image_file_path}")
            
            # Prepare files for upload
            files = {
                'audio': open(audio_file_path, 'rb'),
                'image': open(image_file_path, 'rb')
            }
            
            if options:
                files['options'] = (None, json.dumps(options))
            
            try:
                # Make request without Content-Type header (let requests set it for multipart)
                headers = {
                    'X-API-Key': self.api_key,
                    'X-Device-Fingerprint': self.device_fingerprint,
                    'User-Agent': f'MassUGC-Desktop/1.0.20 ({platform.system()})'
                }
                
                response = self.session.post(
                    f"{self.base_url}/api/desktop/lipsync",
                    headers=headers,
                    files=files,
                    timeout=60
                )
                
                if not response.ok:
                    self._handle_api_error(response)
                
                result = response.json()
                logger.info(f"Video generation started: {result.get('jobId', 'unknown')}")
                return result
                
            finally:
                # Close file handles
                for file_obj in files.values():
                    if hasattr(file_obj, 'close'):
                        file_obj.close()
        
        except Exception as e:
            logger.error(f"Failed to generate video: {e}")
            raise MassUGCApiError(f"Video generation failed: {str(e)}")
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Check processing status of a video generation job"""
        try:
            response = self._make_request('GET', f'jobs/{job_id}')
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get job status for {job_id}: {e}")
            raise MassUGCApiError(f"Failed to get job status: {str(e)}")
    
    
    def poll_job_completion(self, job_id: str, progress_callback=None, poll_interval: int = 2, max_wait_time: int = 600) -> Dict[str, Any]:
        """
        Poll for job completion with progress callbacks
        
        Args:
            job_id: The job ID to poll
            progress_callback: Optional callback function to report progress
            poll_interval: Time between polling requests in seconds
            max_wait_time: Maximum time to wait in seconds
        
        Returns:
            Final job status when completed
        """
        start_time = time.time()
        
        while True:
            try:
                status = self.get_job_status(job_id)
                
                if progress_callback:
                    progress_callback(status)
                
                job_status = status.get('status', 'unknown')
                
                if job_status == 'completed':
                    logger.info(f"Job {job_id} completed successfully")
                    return status
                
                elif job_status == 'failed':
                    error_msg = status.get('error', 'Video generation failed')
                    logger.error(f"Job {job_id} failed: {error_msg}")
                    raise MassUGCApiError(f"Job failed: {error_msg}")
                
                elif job_status in ['pending', 'processing']:
                    # Check timeout
                    if time.time() - start_time > max_wait_time:
                        raise MassUGCApiError(f"Job polling timeout after {max_wait_time} seconds")
                    
                    # Wait before next poll
                    time.sleep(poll_interval)
                    continue
                
                else:
                    logger.warning(f"Unknown job status: {job_status}")
                    time.sleep(poll_interval)
                    continue
                    
            except MassUGCApiError:
                raise
            except Exception as e:
                logger.error(f"Error polling job {job_id}: {e}")
                if time.time() - start_time > max_wait_time:
                    raise MassUGCApiError(f"Job polling failed: {str(e)}")
                time.sleep(poll_interval)
                continue
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics for the current user"""
        try:
            response = self._make_request('GET', 'usage/stats')
            result = response.json()
            
            # Extract data from the response as per API documentation
            data = result.get('data', {})
            return data
            
        except Exception as e:
            logger.error(f"Failed to get usage stats: {e}")
            raise MassUGCApiError(f"Failed to get usage stats: {str(e)}")
    
    def log_usage_data(self, usage_data: Dict[str, Any]) -> Dict[str, Any]:
        """Log usage data to the MassUGC tracking system (non-blocking)"""
        try:
            # Make request directly to avoid error logging for expected 404s
            url = f"{self.base_url}/api/desktop/usage"
            headers = self._create_headers()
            
            response = self.session.post(
                url=url,
                headers=headers,
                json=usage_data,
                timeout=30
            )
            
            if response.ok:
                result = response.json()
                logger.info("Successfully logged usage data to MassUGC Cloud API")
                return result
            elif response.status_code == 404:
                logger.warning("Usage logging endpoint not implemented on server yet - skipping usage tracking")
                return {"skipped": True, "reason": "endpoint_not_implemented"}
            else:
                logger.warning(f"Usage logging failed (HTTP {response.status_code}) but continuing - skipping usage tracking")
                return {"skipped": True, "reason": f"http_{response.status_code}"}
                
        except Exception as e:
            logger.warning(f"Usage logging failed but continuing: {str(e)}")
            return {"skipped": True, "reason": str(e)}


class MassUGCApiKeyManager:
    """Secure API key storage and management"""
    
    def __init__(self, config_dir: Path):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.keyfile_path = self.config_dir / '.massugc_api_key'
    
    def store_api_key(self, api_key: str) -> None:
        """Store API key securely"""
        try:
            # Basic encryption - in production, use proper encryption
            encoded_key = base64.b64encode(api_key.encode()).decode()
            
            with open(self.keyfile_path, 'w') as f:
                f.write(encoded_key)
            
            # Set restrictive permissions
            os.chmod(self.keyfile_path, 0o600)
            logger.info("MassUGC API key stored securely")
            
        except Exception as e:
            logger.error(f"Failed to store API key: {e}")
            raise MassUGCApiError(f"Failed to store API key: {str(e)}")
    
    def get_api_key(self) -> Optional[str]:
        """Retrieve stored API key"""
        try:
            if not self.keyfile_path.exists():
                return None
            
            with open(self.keyfile_path, 'r') as f:
                encoded_key = f.read().strip()
            
            if not encoded_key:
                return None
            
            api_key = base64.b64decode(encoded_key.encode()).decode()
            return api_key
            
        except Exception as e:
            logger.error(f"Failed to retrieve API key: {e}")
            return None
    
    def remove_api_key(self) -> None:
        """Remove stored API key"""
        try:
            if self.keyfile_path.exists():
                self.keyfile_path.unlink()
                logger.info("MassUGC API key removed")
        except Exception as e:
            logger.error(f"Failed to remove API key: {e}")
    
    def has_api_key(self) -> bool:
        """Check if API key is stored"""
        return self.keyfile_path.exists() and self.get_api_key() is not None


def create_massugc_client(api_key: str, base_url: str = 'https://massugc-cloud-api.onrender.com') -> MassUGCApiClient:
    """Factory function to create and initialize MassUGC API client"""
    return MassUGCApiClient(api_key, base_url)


# Example usage
if __name__ == "__main__":
    async def test_client():
        # Test the client
        api_key = "massugc_test_key_1234567890abcdef1234567890abcdef"  # Example format
        client = create_massugc_client(api_key)
        
        try:
            await client.initialize()
            print("Client initialized successfully")
            
            # Test connection
            user_info = await client.validate_connection()
            print(f"Connected as: {user_info}")
            
        except MassUGCApiError as e:
            print(f"API Error: {e.message}")
        except Exception as e:
            print(f"Unexpected error: {e}")
    
    import asyncio
    asyncio.run(test_client())