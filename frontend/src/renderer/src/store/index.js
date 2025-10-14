import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Helper function to generate unique IDs
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Define initial state
const initialState = {
  // Settings
  darkMode: true,
  avatars: [],
  scripts: [],
  clips: [],
  campaigns: [],
  // Jobs (running instances of campaigns)
  jobs: [],
  exports: [],
  // Launch progress notification
  launchNotification: null,
  // Completion notification
  completionNotification: null,
  // Failure notification
  failureNotification: null,
  // Backend status
  backendReady: false,
  // Backend error
  backendError: null,
  // Batch running state (for multiple campaigns)
  isRunningMultiple: false,
  runningProgress: { current: 0, total: 0 },
  batchOperationType: null // 'selected', 'run10x', 'selected10x'
};

// Create store with persistence
export const useStore = create(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Backend status actions
      setBackendReady: (ready) => set({ backendReady: ready }),
      setBackendError: (error) => set({ backendError: error }),
      
      // Settings actions
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),
      
      // Avatar actions
      addAvatar: (avatar) => set(state => ({ 
        avatars: [...state.avatars, { 
          ...avatar, 
          createdAt: avatar.createdAt || new Date().toISOString().split('T')[0]
        }] 
      })),
      removeAvatar: (id) => set(state => ({ 
        avatars: state.avatars.filter(avatar => avatar.id !== id) 
      })),
      
      // Add setAvatars action to replace all avatars
      setAvatars: (avatars) => set({ avatars }),
      
      // Script actions
      addScript: (script) => set(state => ({ 
        scripts: [...state.scripts, { 
          ...script, 
          createdAt: script.createdAt || new Date().toISOString().split('T')[0]
        }] 
      })),
      removeScript: (id) => set(state => ({ 
        scripts: state.scripts.filter(script => script.id !== id) 
      })),
      
      // Add setScripts action to replace all scripts
      setScripts: (scripts) => set({ scripts }),
      
      // Clip actions
      addClip: (clip) => set(state => ({ 
        clips: [...state.clips, { 
          ...clip, 
          createdAt: clip.createdAt || new Date().toISOString().split('T')[0]
        }] 
      })),
      removeClip: (id) => set(state => ({ 
        clips: state.clips.filter(clip => clip.id !== id) 
      })),
      
      // Add setClips action to replace all clips
      setClips: (clips) => set({ clips }),
      
      // Campaign actions (campaigns are just configuration, no state)
      addCampaign: (campaign) => set(state => ({
        campaigns: [
          ...state.campaigns, 
          { 
            ...campaign,
            // Make sure these fields are always set
            avatar_id: campaign.avatar_id || null,
            script_id: campaign.script_id || null,
            status: campaign.status || 'ready',
            created_at: campaign.created_at || new Date().toISOString()
          }
        ]
      })),
      setCampaigns: (campaigns) => set({ campaigns }),
      updateCampaign: (campaignId, updatedData) => set(state => ({
        campaigns: state.campaigns.map(campaign => 
          campaign.id === campaignId 
            ? { 
                ...campaign, 
                ...updatedData,
                // Preserve IDs in case they're not in updatedData
                avatar_id: updatedData.avatar_id !== undefined ? updatedData.avatar_id : campaign.avatar_id,
                script_id: updatedData.script_id !== undefined ? updatedData.script_id : campaign.script_id 
              } 
            : campaign
        )
      })),
      removeCampaign: (campaignId) => set(state => ({
        campaigns: state.campaigns.filter(campaign => campaign.id !== campaignId)
      })),
      
      // Job actions (for running instances of campaigns)
      getActiveJobs: () => {
        const { campaigns, jobs } = get();
        
        // Create an array of job data by joining campaign info
        return jobs.map(job => {
            const campaign = campaigns.find(c => c.id === job.campaignId);
            if (!campaign) return job; // Fallback if campaign not found
            
            return {
              ...campaign,
              run_id: job.runId,
              status: job.status,
              progress: job.progress,
              start_time: job.startTime,
              error: job.error,
              output_path: job.outputPath
            };
          })
          .sort((a, b) => new Date(b.start_time) - new Date(a.start_time)); // Sort by start time, newest first
      },
      
      // Get count of active jobs
      getActiveJobsCount: () => {
        return get().jobs.length;
      },
      
      // Start a new job from a campaign
      startJob: (campaignId, runId) => {
        set(state => ({
          jobs: [...state.jobs, {
            campaignId: campaignId,
            runId: runId,
            status: 'queued',
            progress: 0,
            message: 'Waiting in queue...',
            startTime: new Date().toISOString()
          }]
        }));
      },
      
      // Start multiple jobs with notification
      startMultipleJobs: (count) => {
        set(state => ({
          launchNotification: {
            count,
            message: `${count} campaign${count !== 1 ? 's' : ''} launched`,
            timestamp: new Date().toISOString()
          }
        }));
        
        // Clear notification after 3 seconds
        setTimeout(() => {
          set(state => {
            // Only clear if it's the same notification
            if (state.launchNotification && state.launchNotification.count === count) {
              return { launchNotification: null };
            }
            return {};
          });
        }, 3000);
      },
      
      // Clear launch notification
      clearLaunchNotification: () => set({ launchNotification: null }),
      
      // Clear completion notification
      clearCompletionNotification: () => set({ completionNotification: null }),
      
      // Clear failure notification
      clearFailureNotification: () => set({ failureNotification: null }),
      
      // Batch running actions
      startBatchOperation: (type, total) => set({
        isRunningMultiple: true,
        runningProgress: { current: 0, total },
        batchOperationType: type
      }),
      
      updateBatchProgress: (current, total) => set(state => ({
        runningProgress: { current, total: total || state.runningProgress.total }
      })),
      
      stopBatchOperation: () => set({
        isRunningMultiple: false,
        runningProgress: { current: 0, total: 0 },
        batchOperationType: null
      }),
      
      // Update progress for a job (also transitions from queued to processing)
      updateJobProgress: (campaignId, runId, progress, message) => {
        set(state => ({
          jobs: state.jobs.map(job => {
            if (job.campaignId === campaignId && job.runId === runId) {
              // If job is transitioning from queued to processing, set processingStartTime
              const isTransitioningToProcessing = job.status === 'queued';
              
              return { 
                ...job, 
                status: 'processing', // Set status to processing when progress updates come in
                progress,
                message: message || job.message,
                // Set processingStartTime only on first transition to processing
                ...(isTransitioningToProcessing && { processingStartTime: new Date().toISOString() })
              };
            }
            return job;
          })
        }));
      },
      
      // Mark job as queued (waiting for thread pool slot)
      queueJob: (campaignId, runId, message) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            (job.campaignId === campaignId && job.runId === runId) ? 
            { 
              ...job, 
              status: 'queued',
              progress: 0,
              message: message || 'Waiting in queue...',
              queuedAt: new Date().toISOString()
            } : job
          )
        }));
      },
      
      // Mark job as completed
      completeJob: (campaignId, runId, outputPath) => {
        const completedAt = new Date().toISOString();
        
        set(state => ({
          jobs: state.jobs.map(job =>
            (job.campaignId === campaignId && job.runId === runId) ? 
            { 
              ...job, 
              status: 'completed',
              progress: 100,
              outputPath: outputPath,
              completedAt
            } : job
          )
        }));
        
        // Find the job and campaign details
        const { jobs, campaigns } = get();
        const job = jobs.find(j => j.campaignId === campaignId && j.runId === runId);
        const campaign = campaigns.find(c => c.id === campaignId);
        
        // Show completion notification
        if (campaign) {
          set({
            completionNotification: {
              campaignId,
              runId,
              campaignName: campaign.name,
              outputPath,
              message: `Campaign "${campaign.name}" completed`,
              timestamp: new Date().toISOString()
            }
          });
          
          // Clear notification after 5 seconds
          setTimeout(() => {
            set(state => {
              if (state.completionNotification && 
                  state.completionNotification.runId === runId) {
                return { completionNotification: null };
              }
              return {};
            });
          }, 4000);
        }
        
        // If we have both job and campaign info, add to exports
        if (job && campaign) {
          get().addExport({
            campaignId: campaign.id,
            path: outputPath,
            runId: runId,
            createdAt: completedAt,
            thumbnailColor: getRandomColor()
          });
        }
      },
      
      // Mark job as failed
      failJob: (campaignId, runId, error) => {
        // Convert technical errors to user-friendly messages
        let userMessage = 'Something went wrong';
        
        if (typeof error === 'string' && error.includes('Script file not found')) {
          userMessage = 'Script not found - please check your script selection';
        } else if (error?.includes('GCS upload failed')) {
          userMessage = 'Video upload failed - check your internet connection';
        } else if (error?.includes('API key') || error?.includes('authentication')) {
          userMessage = 'API key issue - check your settings';
        } else if (error?.includes('Job validation failed')) {
          userMessage = 'Campaign setup issue - check your settings';
        }
        
        set(state => ({
          jobs: state.jobs.map(job =>
            (job.campaignId === campaignId && job.runId === runId) ? 
            { 
              ...job, 
              status: 'failed',
              error: userMessage,
              failedAt: new Date().toISOString()
            } : job
          )
        }));
        
        // Show simple notification
        const { campaigns } = get();
        const campaign = campaigns.find(c => c.id === campaignId);
        
        if (campaign) {
          set({
            failureNotification: {
              campaignId,
              runId,
              campaignName: campaign.name,
              error: userMessage,
              message: `Campaign "${campaign.name}" failed`,
              timestamp: new Date().toISOString()
            }
          });
          
          // Clear notification after 6 seconds
          setTimeout(() => {
            set(state => {
              if (state.failureNotification && 
                  state.failureNotification.runId === runId) {
                return { failureNotification: null };
              }
              return {};
            });
          }, 6000);
        }
      },
      
      // Remove a job from the active jobs list
      // Used when a job is no longer on the backend but we didn't get a completion event
      removeJob: (campaignId, runId) => {
        set(state => ({
          jobs: state.jobs.filter(job => 
            !(job.campaignId === campaignId && job.runId === runId)
          )
        }));
      },
      
      // Export actions
      addExport: (exprt) => set(state => ({ 
        exports: [...state.exports, { 
          ...exprt, 
          id: generateId(), 
          createdAt: exprt.createdAt || new Date().toISOString()
        }] 
      })),
      // Legacy method - maintained for backward compatibility
      addExportsForCampaign: (campaignId, count) => {
        const campaign = get().campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        
        const avatar = get().avatars.find(a => a.id === campaign.avatarId);
        const language = avatar ? avatar.language.split(' ')[0] : 'EN';
        const timestamp = Date.now();
        
        const newExports = Array.from({ length: count }, (_, i) => ({
          id: `exp-${timestamp}-${i}`,
          name: `${campaign.name.replace(/\s+/g, '_')}_${language}_${i+1}.mp4`,
          campaignId,
          duration: `${Math.floor(Math.random() * 20) + 20}:${Math.floor(Math.random() * 60)}`,
          createdAt: new Date().toISOString().split('T')[0],
          size: `${(Math.random() * 10 + 2).toFixed(1)} MB`,
          path: null,
          thumbnailColor: getRandomColor()
        }));
        
        set(state => ({ 
          exports: [...newExports, ...state.exports] 
        }));
      },
      removeExport: (id) => set(state => ({ 
        exports: state.exports.filter(exp => exp.id !== id) 
      })),
      
      // Helper methods
      getAvatarById: (id) => get().avatars.find(avatar => avatar.id === id),
      getScriptById: (id) => get().scripts.find(script => script.id === id),
      getClipById: (id) => get().clips.find(clip => clip.id === id),
      getCampaignById: (id) => get().campaigns.find(campaign => campaign.id === id),
      getExportsByCampaignId: (campaignId) => get().exports.filter(exprt => exprt.campaignId === campaignId),
    }),
    {
      name: 'massugc-studio-storage',
    }
  )
);

// Helper function to generate consistent dark color for thumbnails
const getRandomColor = () => {
  // Always return the same dark color close to black
  return 'bg-neutral-900';
}; 