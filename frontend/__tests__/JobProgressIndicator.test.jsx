import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import JobProgressIndicator from '../src/renderer/src/components/JobProgressIndicator';
import { useStore } from '../src/renderer/src/store';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn()
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }) => <div data-testid="animate-presence">{children}</div>
}));

jest.mock('@heroicons/react/24/outline', () => ({
  PlayIcon: ({ className }) => <div data-testid="play-icon" className={className} />,
  CheckCircleIcon: ({ className }) => <div data-testid="check-icon" className={className} />,
  XCircleIcon: ({ className }) => <div data-testid="x-icon" className={className} />,
  DocumentTextIcon: ({ className }) => <div data-testid="document-icon" className={className} />,
  ExclamationTriangleIcon: ({ className }) => <div data-testid="warning-icon" className={className} />
}));

jest.mock('../src/renderer/src/store', () => ({
  useStore: jest.fn()
}));

// Mock the useNavigate hook
const mockNavigate = jest.fn();
require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

describe('JobProgressIndicator', () => {
  const mockClearLaunchNotification = jest.fn();
  const mockClearCompletionNotification = jest.fn();
  const mockClearFailureNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    
    // Default mock store state
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [
          { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 },
          { campaignId: 'campaign2', runId: 'run2', status: 'completed', progress: 100 },
          { campaignId: 'campaign3', runId: 'run3', status: 'queued', progress: 0 }
        ],
        launchNotification: null,
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
  });

  test('renders nothing when no active jobs and no notifications', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [
          { campaignId: 'campaign1', runId: 'run1', status: 'completed', progress: 100 },
          { campaignId: 'campaign2', runId: 'run2', status: 'failed', progress: 0 }
        ],
        launchNotification: null,
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    const { container } = render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Component always renders the notifications container, but no active jobs indicator
    expect(container.querySelector('.fixed.z-20')).toBeNull();
    expect(container.querySelector('.fixed.z-30')).toBeInTheDocument();
  });

  test('renders active jobs indicator', () => {
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('2 jobs running')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByTestId('play-icon')).toBeInTheDocument();
  });

  test('calculates stats for active jobs only', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [
          { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 60 },
          { campaignId: 'campaign2', runId: 'run2', status: 'queued', progress: 0 },
          { campaignId: 'campaign3', runId: 'run3', status: 'completed', progress: 100 },
          { campaignId: 'campaign4', runId: 'run4', status: 'failed', progress: 0 }
        ],
        launchNotification: null,
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Only processing and queued jobs: (60 + 0) / 2 = 30
    expect(screen.getByText('2 jobs running')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  test('renders launch notification', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: { message: 'Job started successfully' },
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Job started successfully')).toBeInTheDocument();
    expect(screen.getByTestId('play-icon')).toBeInTheDocument();
  });

  test('renders completion notification', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: null,
        completionNotification: { 
          message: 'Video generation completed!', 
          outputPath: '/path/to/video.mp4' 
        },
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Video generation completed!')).toBeInTheDocument();
    expect(screen.getByText('Click to view exports')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  test('renders failure notification', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: null,
        completionNotification: null,
        failureNotification: { error: 'Video generation failed' },
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Video generation failed')).toBeInTheDocument();
    expect(screen.getByText('Click to dismiss')).toBeInTheDocument();
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  test('handles view export click', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: null,
        completionNotification: { 
          message: 'Video generation completed!', 
          outputPath: '/path/to/video.mp4' 
        },
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Click on the completion notification itself
    const completionNotification = screen.getByText('Video generation completed!').closest('div');
    fireEvent.click(completionNotification);
    
    expect(mockNavigate).toHaveBeenCalledWith('/exports');
    expect(mockClearCompletionNotification).toHaveBeenCalled();
  });

  test('handles dismiss failure notification click', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: null,
        completionNotification: null,
        failureNotification: { error: 'Video generation failed' },
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Click on the failure notification itself
    const failureNotification = screen.getByText('Video generation failed').closest('div');
    fireEvent.click(failureNotification);
    
    expect(mockClearFailureNotification).toHaveBeenCalled();
  });

  test('navigates to /running on active jobs indicator click', () => {
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    const indicator = screen.getByText('2 jobs running').closest('div');
    fireEvent.click(indicator);
    
    expect(mockNavigate).toHaveBeenCalledWith('/running');
  });

  test('applies dark mode styling', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: true,
        jobs: [
          { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 }
        ],
        launchNotification: null,
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    const { container } = render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Find the active jobs indicator container
    const indicator = container.querySelector('.fixed.z-20');
    expect(indicator).toHaveClass('bg-surface-dark-warm/95', 'border-content-700/50');
  });

  test('handles jobs with undefined progress', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [
          { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: undefined },
          { campaignId: 'campaign2', runId: 'run2', status: 'queued', progress: 50 }
        ],
        launchNotification: null,
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Should treat undefined progress as 0: (0 + 50) / 2 = 25
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  test('renders multiple notifications', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: { message: 'Job started' },
        completionNotification: { 
          message: 'Job completed', 
          outputPath: '/path/to/video.mp4' 
        },
        failureNotification: { error: 'Job failed' },
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Job started')).toBeInTheDocument();
    expect(screen.getByText('Job completed')).toBeInTheDocument();
    expect(screen.getByText('Job failed')).toBeInTheDocument();
  });

  test('handles empty jobs array', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        jobs: [],
        launchNotification: null,
        completionNotification: null,
        failureNotification: null,
        clearLaunchNotification: mockClearLaunchNotification,
        clearCompletionNotification: mockClearCompletionNotification,
        clearFailureNotification: mockClearFailureNotification
      };
      return selector(state);
    });
    
    const { container } = render(
      <BrowserRouter>
        <JobProgressIndicator />
      </BrowserRouter>
    );
    
    // Component always renders the notifications container, but no active jobs indicator
    expect(container.querySelector('.fixed.z-20')).toBeNull();
    expect(container.querySelector('.fixed.z-30')).toBeInTheDocument();
  });
});
