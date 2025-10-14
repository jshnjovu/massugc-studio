import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import CampaignsPage from './pages/CampaignsPage';
import RunningCampaignsPage from './pages/RunningCampaignsPage';
import AvatarsPage from './pages/AvatarsPage';
import ScriptsPage from './pages/ScriptsPage';
import ProductClipsPage from './pages/ProductClipsPage';
import MusicPage from './pages/MusicPage';
import ExportsPage from './pages/ExportsPage';
import SettingsPage from './pages/SettingsPage';
import LoadingScreen from './components/LoadingScreen';
import DarkModeProvider from './components/DarkModeProvider';
import JobProgressIndicator from './components/JobProgressIndicator';
import JobProgressService from './services/JobProgressService';
import { useStore } from './store';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const darkMode = useStore(state => state.darkMode);
  const backendReady = useStore(state => state.backendReady);
  const setBackendReady = useStore(state => state.setBackendReady);
  const setBackendError = useStore(state => state.setBackendError);
  const jobs = useStore(state => state.jobs);

  // Initialize backend status as not ready
  useEffect(() => {
    // Explicitly set to false when component mounts
    setBackendReady(false);
    
    // Clear any leftover batch operation state from previous session
    // This ensures run buttons are enabled on app startup
    const stopBatchOperation = useStore.getState().stopBatchOperation;
    stopBatchOperation();
  }, []);

  // Check if backend is ready
  useEffect(() => {
    const checkBackendStatus = async () => {
      console.log('[DEBUG] Starting backend status check...');
      
      try {
        // Try direct fetch to backend first (most reliable)
        try {
          console.log('[DEBUG] Trying direct fetch to http://localhost:2026/health');
          const response = await fetch('http://localhost:2026/health', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });
          
          console.log('[DEBUG] Health check response status:', response.status);
          console.log('[DEBUG] Health check response ok:', response.ok);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[SUCCESS] Health check response data:', data);
            console.log('[SUCCESS] Backend is ready! Proceeding to main app.');
            setBackendReady(true);
            setBackendError(null);
            return true;
          } else {
            console.log('[ERROR] Health check failed with status:', response.status);
          }
        } catch (fetchError) {
          console.log('[ERROR] Direct fetch to /health failed:', fetchError.message);
          
          // Try alternative endpoints to see if backend is responding at all
          try {
            console.log('[DEBUG] Trying alternative check - fetching campaigns...');
            const altResponse = await fetch('http://localhost:2026/campaigns', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              timeout: 5000
            });
            
            if (altResponse.ok || altResponse.status === 403) {
              console.log('[SUCCESS] Backend is responding (alternative check passed)! Proceeding to main app.');
              setBackendReady(true);
              setBackendError(null);
              return true;
            }
          } catch (altError) {
            console.log('[ERROR] Alternative endpoint check also failed:', altError.message);
          }
        }

        // If direct fetch failed, try IPC (Electron specific)
        if (window.electron && window.electron.ipcRenderer) {
          try {
            console.log('[DEBUG] Trying IPC backend status check...');
            const status = await window.electron.ipcRenderer.invoke('check-backend-status');
            console.log('[DEBUG] IPC Backend status result:', status);
            
            if (status && status.running) {
              console.log('[SUCCESS] IPC check succeeded! Proceeding to main app.');
              setTimeout(() => {
                setBackendReady(true);
                setBackendError(null);
              }, 500);
              return true;
            } else {
              console.log('[ERROR] IPC check indicates backend not running');
            }
          } catch (ipcError) {
            console.log('[ERROR] IPC check failed:', ipcError.message);
          }
        } else {
          console.log('[INFO] No Electron API available, skipping IPC check');
        }

        console.log('[ERROR] All backend checks failed, will retry...');
        return false;
        
      } catch (error) {
        console.error('[ERROR] Unexpected error in backend check:', error);
        return false;
      }
    };

    // Start checking backend status immediately
    checkBackendStatus();
    
    // Retry every 2 seconds until backend is ready
    const retryInterval = setInterval(() => {
      if (!backendReady) {
        console.log('[DEBUG] Retrying backend status check...');
        checkBackendStatus();
      } else {
        console.log('[SUCCESS] Backend ready, stopping retry interval');
        clearInterval(retryInterval);
      }
    }, 2000);

    // Clean up interval
    return () => {
      clearInterval(retryInterval);
    };
  }, [setBackendReady, setBackendError, backendReady]);

  // Initialize JobProgressService and resume tracking any active jobs
  useEffect(() => {
    // Only initialize if backend is ready
    if (!backendReady) return;

    const service = JobProgressService.getInstance();
    const resumedCount = service.resumeAllJobs();
    console.log(`Resumed tracking ${resumedCount} active jobs`);

    // Clean up event sources when app unmounts
    return () => {
      service.stopAll();
    };
  }, [backendReady]);

  // Show loading screen if backend is not ready
  if (!backendReady) {
    console.log('Showing loading screen. Backend ready:', backendReady);
    return (
      <DarkModeProvider>
        <LoadingScreen />
      </DarkModeProvider>
    );
  }

  return (
    <DarkModeProvider>
      <div className={`flex h-screen overflow-hidden transition-all duration-300 ease-out bg-noise
        ${darkMode 
          ? 'bg-gradient-dark-warm text-content-300' 
          : 'bg-gradient-warm text-content-700'
        }`}>
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} />

        {/* Main Content */}
        <div className={`flex flex-col flex-1 transition-all duration-300 ease-out ${sidebarOpen ? 'ml-20' : 'ml-0'}`}>
          <TitleBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          {/* Global Job Progress Indicator */}
          <JobProgressIndicator />
          
          <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-8 px-6 lg:px-8 w-full">
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<Navigate to="/campaigns" replace />} />
                  <Route path="/campaigns" element={<CampaignsPage />} />
                  <Route path="/running" element={<RunningCampaignsPage />} />
                  <Route path="/avatars" element={<AvatarsPage />} />
                  <Route path="/scripts" element={<ScriptsPage />} />
                  <Route path="/clips" element={<ProductClipsPage />} />
                  <Route path="/music" element={<MusicPage />} />
                  <Route path="/exports" element={<ExportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </DarkModeProvider>
  );
}

export default App; 