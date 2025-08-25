import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LeagueStandings from '../LeagueStandings.vue';
import { PlayerService } from '../../services/PlayerService';
import type { LeagueStanding } from '@shared/types/player';
import type { RaceResult, PlayerStatistics } from '@shared/types/player';

// Mock the PlayerService
vi.mock('../../services/PlayerService', () => ({
  PlayerService: {
    getLeagueStandings: vi.fn(),
    getPlayerRaceHistory: vi.fn(),
    getPlayerStatistics: vi.fn()
  }
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('LeagueStandings', () => {
  let wrapper: VueWrapper<any>;
  let pinia: any;

  const mockStandings: LeagueStanding[] = [
    {
      playerId: 'player-1',
      username: 'SpeedRacer',
      leaguePoints: 150,
      totalRaces: 10,
      wins: 3,
      position: 1
    },
    {
      playerId: 'player-2',
      username: 'FastDriver',
      leaguePoints: 120,
      totalRaces: 8,
      wins: 2,
      position: 2
    },
    {
      playerId: 'current-player',
      username: 'TestPlayer',
      leaguePoints: 90,
      totalRaces: 6,
      wins: 1,
      position: 3
    }
  ];

  const mockRaceHistory: RaceResult[] = [
    {
      raceId: 'race-1',
      playerId: 'current-player',
      carId: 'car-1',
      finalPosition: 2,
      finalTime: 125.456,
      lapTimes: [62.123, 63.333],
      raceEvents: ['event-1', 'event-2'],
      points: 18,
      completedAt: new Date('2024-01-15T10:30:00Z')
    },
    {
      raceId: 'race-2',
      playerId: 'current-player',
      carId: 'car-2',
      finalPosition: 1,
      finalTime: 120.789,
      lapTimes: [60.123, 60.666],
      raceEvents: ['event-3'],
      points: 25,
      completedAt: new Date('2024-01-10T14:15:00Z')
    }
  ];

  const mockStatistics: PlayerStatistics = {
    averageLapTime: 61.5,
    bestLapTime: 60.123,
    totalRaceTime: 246.245,
    podiumFinishes: 2,
    dnfCount: 0,
    averagePosition: 1.5
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(PlayerService.getLeagueStandings).mockResolvedValue(mockStandings);
    vi.mocked(PlayerService.getPlayerRaceHistory).mockResolvedValue(mockRaceHistory);
    vi.mocked(PlayerService.getPlayerStatistics).mockResolvedValue(mockStatistics);
    
    // Mock localStorage for current player
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'currentPlayerId') return 'current-player';
      return null;
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Mounting and Initial State', () => {
    it('should mount successfully', async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.league-standings').exists()).toBe(true);
    });

    it('should show loading state when refreshing data', async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      // Wait for initial load to complete
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Mock a slow API call for refresh
      let resolveStandings: (value: any) => void;
      const standingsPromise = new Promise(resolve => { resolveStandings = resolve; });
      vi.mocked(PlayerService.getLeagueStandings).mockReturnValue(standingsPromise as any);

      // Trigger refresh
      const refreshPromise = wrapper.vm.refreshData();
      await wrapper.vm.$nextTick();

      // Should show loading during refresh
      expect(wrapper.find('.loading').exists()).toBe(true);
      expect(wrapper.find('.loading').text()).toBe('Loading...');

      // Resolve to clean up
      resolveStandings!(mockStandings);
      await refreshPromise;
    });

    it('should load data on mount', async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      // Wait for async operations
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(PlayerService.getLeagueStandings).toHaveBeenCalledWith(50);
      expect(PlayerService.getPlayerRaceHistory).toHaveBeenCalledWith(50);
      expect(PlayerService.getPlayerStatistics).toHaveBeenCalled();
    });
  });

  describe('League Standings View', () => {
    beforeEach(async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      // Wait for data to load
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
    });

    it('should display standings table with correct data', () => {
      const standingsView = wrapper.find('.standings-view');
      expect(standingsView.exists()).toBe(true);

      const tableRows = wrapper.findAll('.standings-table .table-row');
      expect(tableRows).toHaveLength(3);

      // Check first row data
      const firstRow = tableRows[0];
      expect(firstRow.find('.position').text()).toBe('1');
      expect(firstRow.find('.username').text()).toBe('SpeedRacer');
      expect(firstRow.find('.points').text()).toBe('150');
      expect(firstRow.find('.races').text()).toBe('10');
      expect(firstRow.find('.wins').text()).toBe('3');
    });

    it('should highlight current player row', () => {
      const tableRows = wrapper.findAll('.standings-table .table-row');
      const currentPlayerRow = tableRows[2]; // Third row is current player
      
      expect(currentPlayerRow.classes()).toContain('current-player');
      expect(currentPlayerRow.find('.username').text()).toBe('TestPlayer');
    });

    it('should show empty state when no standings available', async () => {
      vi.mocked(PlayerService.getLeagueStandings).mockResolvedValue([]);
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.find('.empty-state').text()).toBe('No league standings available yet.');
    });
  });

  describe('Race History View', () => {
    beforeEach(async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      // Wait for data to load
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Switch to history view
      const historyButton = wrapper.find('button:nth-child(2)');
      await historyButton.trigger('click');
    });

    it('should switch to race history view', () => {
      expect(wrapper.find('.history-view').exists()).toBe(true);
      expect(wrapper.find('.standings-view').exists()).toBe(false);
    });

    it('should display race history table with correct data', () => {
      const tableRows = wrapper.findAll('.history-table .table-row');
      expect(tableRows).toHaveLength(2);

      // Check first row data (most recent race)
      const firstRow = tableRows[0];
      expect(firstRow.find('.position').text()).toBe('2');
      expect(firstRow.find('.time').text()).toBe('2:05.456');
      expect(firstRow.find('.points').text()).toBe('18');
    });

    it('should format dates correctly', () => {
      const tableRows = wrapper.findAll('.history-table .table-row');
      const firstRow = tableRows[0];
      
      expect(firstRow.find('.date').text()).toBe('Jan 15, 2024');
    });

    it('should show empty state when no race history available', async () => {
      vi.mocked(PlayerService.getPlayerRaceHistory).mockResolvedValue([]);
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Switch to history view
      const historyButton = wrapper.find('button:nth-child(2)');
      await historyButton.trigger('click');

      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.find('.empty-state').text()).toBe('No race history available yet.');
    });
  });

  describe('Statistics View', () => {
    beforeEach(async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      // Wait for data to load
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Switch to statistics view
      const statisticsButton = wrapper.find('button:nth-child(3)');
      await statisticsButton.trigger('click');
    });

    it('should switch to statistics view', () => {
      expect(wrapper.find('.statistics-view').exists()).toBe(true);
      expect(wrapper.find('.standings-view').exists()).toBe(false);
    });

    it('should display statistics cards with correct data', () => {
      const statCards = wrapper.findAll('.stat-card');
      expect(statCards).toHaveLength(6);

      // Check average position card
      const avgPositionCard = statCards[0];
      expect(avgPositionCard.find('.stat-label').text()).toBe('Average Position');
      expect(avgPositionCard.find('.stat-value').text()).toBe('1.5');

      // Check podium finishes card
      const podiumCard = statCards[1];
      expect(podiumCard.find('.stat-label').text()).toBe('Podium Finishes');
      expect(podiumCard.find('.stat-value').text()).toBe('2');
    });

    it('should format time statistics correctly', () => {
      const statCards = wrapper.findAll('.stat-card');
      
      // Check total race time card
      const totalTimeCard = statCards[3];
      expect(totalTimeCard.find('.stat-label').text()).toBe('Total Race Time');
      expect(totalTimeCard.find('.stat-value').text()).toBe('4:06.245');

      // Check best lap time card
      const bestLapCard = statCards[4];
      expect(bestLapCard.find('.stat-label').text()).toBe('Best Lap Time');
      expect(bestLapCard.find('.stat-value').text()).toBe('1:00.123');
    });

    it('should show empty state when no statistics available', async () => {
      vi.mocked(PlayerService.getPlayerStatistics).mockResolvedValue(null as any);
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Switch to statistics view
      const statisticsButton = wrapper.find('button:nth-child(3)');
      await statisticsButton.trigger('click');

      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.find('.empty-state').text()).toBe('No statistics available yet.');
    });
  });

  describe('View Controls', () => {
    beforeEach(async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
    });

    it('should have correct active button initially', () => {
      const buttons = wrapper.findAll('.view-controls button');
      expect(buttons[0].classes()).toContain('active'); // Standings button
      expect(buttons[1].classes()).not.toContain('active'); // History button
      expect(buttons[2].classes()).not.toContain('active'); // Statistics button
    });

    it('should switch active button when clicked', async () => {
      const buttons = wrapper.findAll('.view-controls button');
      
      // Click history button
      await buttons[1].trigger('click');
      
      expect(buttons[0].classes()).not.toContain('active');
      expect(buttons[1].classes()).toContain('active');
      expect(buttons[2].classes()).not.toContain('active');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API calls fail', async () => {
      const errorMessage = 'Failed to fetch data';
      vi.mocked(PlayerService.getLeagueStandings).mockRejectedValue(new Error(errorMessage));
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.error').exists()).toBe(true);
      expect(wrapper.find('.error').text()).toContain(errorMessage);
    });

    it('should have retry button in error state', async () => {
      vi.mocked(PlayerService.getLeagueStandings).mockRejectedValue(new Error('Network error'));
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      const retryButton = wrapper.find('.retry-button');
      expect(retryButton.exists()).toBe(true);
      expect(retryButton.text()).toBe('Retry');
    });

    it('should retry data loading when retry button is clicked', async () => {
      // First call fails
      vi.mocked(PlayerService.getLeagueStandings).mockRejectedValueOnce(new Error('Network error'));
      // Second call succeeds
      vi.mocked(PlayerService.getLeagueStandings).mockResolvedValueOnce(mockStandings);
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Should show error initially
      expect(wrapper.find('.error').exists()).toBe(true);

      // Click retry
      const retryButton = wrapper.find('.retry-button');
      await retryButton.trigger('click');
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Should show standings after retry
      expect(wrapper.find('.error').exists()).toBe(false);
      expect(wrapper.find('.standings-view').exists()).toBe(true);
    });
  });

  describe('Authentication Handling', () => {
    it('should handle authentication errors gracefully for race history', async () => {
      vi.mocked(PlayerService.getPlayerRaceHistory).mockRejectedValue(
        new Error('Authentication required')
      );
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Should not show error, but should show empty race history
      expect(wrapper.find('.error').exists()).toBe(false);
      
      // Switch to history view
      const historyButton = wrapper.find('button:nth-child(2)');
      await historyButton.trigger('click');

      expect(wrapper.find('.empty-state').exists()).toBe(true);
    });

    it('should handle authentication errors gracefully for statistics', async () => {
      vi.mocked(PlayerService.getPlayerStatistics).mockRejectedValue(
        new Error('Authentication required')
      );
      
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Should not show error, but should show empty statistics
      expect(wrapper.find('.error').exists()).toBe(false);
      
      // Switch to statistics view
      const statisticsButton = wrapper.find('button:nth-child(3)');
      await statisticsButton.trigger('click');

      expect(wrapper.find('.empty-state').exists()).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
    });

    it('should format time correctly', () => {
      const component = wrapper.vm;
      
      expect(component.formatTime(0)).toBe('N/A');
      expect(component.formatTime(65.123)).toBe('1:05.123');
      expect(component.formatTime(125.456)).toBe('2:05.456');
      expect(component.formatTime(3661.789)).toBe('61:01.789');
    });

    it('should format date correctly', () => {
      const component = wrapper.vm;
      const testDate = new Date('2024-01-15T10:30:00Z');
      
      expect(component.formatDate(testDate)).toBe('Jan 15, 2024');
    });

    it('should identify current player correctly', () => {
      const component = wrapper.vm;
      
      expect(component.isCurrentPlayer('current-player')).toBe(true);
      expect(component.isCurrentPlayer('other-player')).toBe(false);
    });
  });

  describe('Refresh Functionality', () => {
    it('should expose refresh methods', async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      expect(wrapper.vm.refreshData).toBeDefined();
      expect(wrapper.vm.loadStandings).toBeDefined();
      expect(wrapper.vm.loadRaceHistory).toBeDefined();
      expect(wrapper.vm.loadStatistics).toBeDefined();
    });

    it('should refresh data when refreshData is called', async () => {
      wrapper = mount(LeagueStandings, {
        global: {
          plugins: [pinia]
        }
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Call refresh
      await wrapper.vm.refreshData();

      expect(PlayerService.getLeagueStandings).toHaveBeenCalledWith(50);
      expect(PlayerService.getPlayerRaceHistory).toHaveBeenCalledWith(50);
      expect(PlayerService.getPlayerStatistics).toHaveBeenCalled();
    });
  });
});