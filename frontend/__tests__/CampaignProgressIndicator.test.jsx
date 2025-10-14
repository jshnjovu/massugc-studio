import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { motion } from 'framer-motion';
import CampaignProgressIndicator from '../src/renderer/src/components/CampaignProgressIndicator';
import { useStore } from '../src/renderer/src/store';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn()
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>
  }
}));

jest.mock('@heroicons/react/24/outline', () => ({
  PlayIcon: ({ className }) => <div data-testid="play-icon" className={className} />
}));

jest.mock('../src/renderer/src/store', () => ({
  useStore: jest.fn()
}));

// Mock the useNavigate hook
const mockNavigate = jest.fn();
require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

describe('CampaignProgressIndicator', () => {
  const mockGetActiveJobs = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    
    // Default mock store state
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: false,
        getActiveJobs: mockGetActiveJobs
      };
      return selector(state);
    });
  });

  test('renders nothing when no active jobs', () => {
    mockGetActiveJobs.mockReturnValue([]);
    
    const { container } = render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('renders with active jobs', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 },
      { campaignId: 'campaign2', runId: 'run2', status: 'queued', progress: 0 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('2 jobs running')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByTestId('play-icon')).toBeInTheDocument();
  });

  test('renders singular job text for single job', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 75 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    expect(screen.getByText('1 job running')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  test('calculates average progress correctly', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 30 },
      { campaignId: 'campaign2', runId: 'run2', status: 'processing', progress: 70 },
      { campaignId: 'campaign3', runId: 'run3', status: 'queued', progress: 0 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    // Average: (30 + 70 + 0) / 3 = 33.33, rounded to 33
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  test('navigates to /running on click', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    const indicator = screen.getByText('1 job running').closest('div').parentElement;
    fireEvent.click(indicator);
    
    expect(mockNavigate).toHaveBeenCalledWith('/running');
  });

  test('applies dark mode styling', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    // Mock dark mode
    useStore.mockImplementation((selector) => {
      const state = {
        darkMode: true,
        getActiveJobs: mockGetActiveJobs
      };
      return selector(state);
    });
    
    const { container } = render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    // Find the motion.div element that contains the styling classes
    const indicator = container.querySelector('.fixed.z-20');
    expect(indicator).toHaveClass('bg-dark-700', 'border-dark-600');
  });

  test('applies light mode styling', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    const { container } = render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    // Find the motion.div element that contains the styling classes
    const indicator = container.querySelector('.fixed.z-20');
    expect(indicator).toHaveClass('bg-white', 'border-primary-200');
  });

  test('handles jobs with undefined progress', () => {
    const activeJobs = [
      { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: undefined },
      { campaignId: 'campaign2', runId: 'run2', status: 'queued', progress: 50 }
    ];
    mockGetActiveJobs.mockReturnValue(activeJobs);
    
    render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    // Should treat undefined progress as 0: (0 + 50) / 2 = 25
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  test('handles empty active jobs array', () => {
    mockGetActiveJobs.mockReturnValue([]);
    
    const { container } = render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('handles null active jobs', () => {
    mockGetActiveJobs.mockReturnValue(null);
    
    const { container } = render(
      <BrowserRouter>
        <CampaignProgressIndicator />
      </BrowserRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });
});
