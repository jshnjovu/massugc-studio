/**
 * React Query Hooks for Data Operations
 * 
 * Professional data fetching and caching using React Query (@tanstack/react-query).
 * Provides instant UI updates with optimistic updates and automatic cache invalidation.
 * 
 * Features:
 * - Smart caching (5 minute stale time)
 * - Optimistic updates (instant UI feedback)
 * - Automatic background refetching
 * - Error handling with rollback
 * - Loading states
 * 
 * @module useData
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import electronDataService from '../services/electronDataService';

// ==================== CAMPAIGNS ====================

/**
 * Hook to fetch all campaigns with caching
 * @returns {Object} Query result with data, isLoading, error
 */
export const useCampaigns = () => {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const result = await electronDataService.getCampaigns();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch campaigns');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
  });
};

/**
 * Hook to fetch a single campaign by ID
 * @param {string} id - Campaign ID
 * @returns {Object} Query result with data, isLoading, error
 */
export const useCampaign = (id) => {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const result = await electronDataService.getCampaign(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch campaign');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id, // Only fetch if ID is provided
  });
};

/**
 * Hook to create a new campaign
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useCreateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignData) => {
      const result = await electronDataService.createCampaign(campaignData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create campaign');
      }
      return result.data;
    },
    onSuccess: (newCampaign) => {
      // Invalidate campaigns list to refetch with new data
      queryClient.invalidateQueries(['campaigns']);
    },
  });
};

/**
 * Hook to update an existing campaign with optimistic updates
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const result = await electronDataService.updateCampaign(id, updates);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update campaign');
      }
      return result.data;
    },
    // Optimistic update - update UI immediately before server responds
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['campaigns']);

      // Snapshot the previous value
      const previousCampaigns = queryClient.getQueryData(['campaigns']);

      // Optimistically update to the new value
      queryClient.setQueryData(['campaigns'], (old) =>
        old ? old.map((campaign) => (campaign.id === id ? { ...campaign, ...updates } : campaign)) : old
      );

      // Return context with previous value
      return { previousCampaigns };
    },
    // If the mutation fails, roll back to the previous value
    onError: (err, variables, context) => {
      queryClient.setQueryData(['campaigns'], context.previousCampaigns);
    },
    // Always refetch after error or success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries(['campaigns']);
    },
  });
};

/**
 * Hook to delete a campaign with optimistic updates
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const result = await electronDataService.deleteCampaign(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete campaign');
      }
      return id;
    },
    // Optimistic update - remove from UI immediately
    onMutate: async (id) => {
      await queryClient.cancelQueries(['campaigns']);
      const previousCampaigns = queryClient.getQueryData(['campaigns']);

      // Remove campaign from cache
      queryClient.setQueryData(['campaigns'], (old) => (old ? old.filter((campaign) => campaign.id !== id) : old));

      return { previousCampaigns };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['campaigns'], context.previousCampaigns);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['campaigns']);
    },
  });
};

// ==================== AVATARS ====================

/**
 * Hook to fetch all avatars with caching
 * @returns {Object} Query result with data, isLoading, error
 */
export const useAvatars = () => {
  return useQuery({
    queryKey: ['avatars'],
    queryFn: async () => {
      const result = await electronDataService.getAvatars();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch avatars');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to create a new avatar
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useCreateAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (avatarData) => {
      const result = await electronDataService.createAvatar(avatarData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create avatar');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['avatars']);
    },
  });
};

/**
 * Hook to delete an avatar with optimistic updates
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useDeleteAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const result = await electronDataService.deleteAvatar(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete avatar');
      }
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries(['avatars']);
      const previousAvatars = queryClient.getQueryData(['avatars']);
      queryClient.setQueryData(['avatars'], (old) => (old ? old.filter((avatar) => avatar.id !== id) : old));
      return { previousAvatars };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['avatars'], context.previousAvatars);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['avatars']);
    },
  });
};

// ==================== SCRIPTS ====================

/**
 * Hook to fetch all scripts with caching
 * @returns {Object} Query result with data, isLoading, error
 */
export const useScripts = () => {
  return useQuery({
    queryKey: ['scripts'],
    queryFn: async () => {
      const result = await electronDataService.getScripts();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch scripts');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to create a new script
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useCreateScript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scriptData) => {
      const result = await electronDataService.createScript(scriptData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create script');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['scripts']);
    },
  });
};

/**
 * Hook to delete a script with optimistic updates
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useDeleteScript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const result = await electronDataService.deleteScript(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete script');
      }
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries(['scripts']);
      const previousScripts = queryClient.getQueryData(['scripts']);
      queryClient.setQueryData(['scripts'], (old) => (old ? old.filter((script) => script.id !== id) : old));
      return { previousScripts };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['scripts'], context.previousScripts);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['scripts']);
    },
  });
};

// ==================== CLIPS ====================

/**
 * Hook to fetch all clips with caching
 * @returns {Object} Query result with data, isLoading, error
 */
export const useClips = () => {
  return useQuery({
    queryKey: ['clips'],
    queryFn: async () => {
      const result = await electronDataService.getClips();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch clips');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to create a new clip
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useCreateClip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clipData) => {
      const result = await electronDataService.createClip(clipData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create clip');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clips']);
    },
  });
};

/**
 * Hook to delete a clip with optimistic updates
 * @returns {Object} Mutation object with mutate, mutateAsync, isLoading
 */
export const useDeleteClip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const result = await electronDataService.deleteClip(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete clip');
      }
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries(['clips']);
      const previousClips = queryClient.getQueryData(['clips']);
      queryClient.setQueryData(['clips'], (old) => (old ? old.filter((clip) => clip.id !== id) : old));
      return { previousClips };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['clips'], context.previousClips);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['clips']);
    },
  });
};

