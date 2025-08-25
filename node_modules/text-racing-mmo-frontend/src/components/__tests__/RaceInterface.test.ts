import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import RaceInterface from '../RaceInterface.vue';
import { useGameStore } from '../../stores/game';
import { useWebSocketStore } from '../../stores/websocket';
import type { RaceState, ParticipantState, RaceEvent } from '@shared/types/index';

// Mock the stores
vi.mock('../../stores/websocket');
vi.mock('../../stores/game');

// Mock data
const mockParticipant: ParticipantState = {
  playerId: 'player-1',
  carId: 'honda-civic-type-r-2023',
  position: 2,
  lapTime: 87.543,
  totalTime: 175.086,
  fuel: 65,
  tireWear: {
    front: 25,
    rear: 30
  },
  speed: 145.7,
  location: {
    lap: 2,
    sector: 1,
    distance: 1250
  },
  lastCommand: 'accelerate 80',
  commandTimestamp: Date.now()
};

const mockRaceState: RaceState = {
  raceId: 'race-123',
  trackId: 'track-1',
  currentLap: 2,
  totalLaps: 10,
  raceTime: 175.086,
  participants: [
    mockParticipant,
    {
      playerId: 'player-2',
      carId: 'porsche-911-gt3-2022',
      position: 1,
      lapTime: 85.123,
      totalTime: 170.246,
      fuel: 70,
      tireWear: { front: 20, rear: 25 },
      speed: 152.3,
      location: { lap: 2, sector: 1, distance: 1400 },
      lastCommand: 'shift 6',
      commandTimestamp: Date.now()
    }
  ],
  raceEvents: [],
  weather: {
    temperature: 22,
    humidity: 45,
    windSpeed: 15,
    precipitation: 0,
    visibility: 10000
  },
  trackConditions: {
    surface: 'dry',
    grip: 1.0,
    temperature: 28
  }
};

const mockRaceEvents: RaceEvent[] = [
  {
    id: 'event-1',
    timestamp: 120.5,
    type: 'overtake',
    description: 'Player-2 overtakes Player-1 at turn 3',
    involvedPlayers: ['player-1', 'player-2']
  },
  {
    id: 'event-2',
    timestamp: 87.2,
    type: 'lap_complete',
    description: 'Player-1 completes lap 1 in 87.200s',
    involvedPlayers: ['player-1']
  }
];

describe('RaceInterface Component', () => {
  let gameStore: any;
  let websocketStore: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Mock game store
    gameStore = {
      isInRace: true,
      currentRace: mockRaceState,
      myParticipant: mockParticipant,
      sortedParticipants: mockRaceState.participants.sort((a, b) => a.position - b.position),
      recentEvents: mockRaceEvents
    };

    // Mock websocket store
    websocketStore = {
      isConnected: true,
      sendMessage: vi.fn()
    };

    // Reset mocks to default values
    vi.mocked(useGameStore).mockReturnValue(gameStore);
    vi.mocked(useWebSocketStore).mockReturnValue(websocketStore);
  });

  describe('Component Rendering', () => {
    it('renders all main sections', () => {
      const wrapper = mount(RaceInterface);

      expect(wrapper.find('.command-section').exists()).toBe(true);
      expect(wrapper.find('.race-state-section').exists()).toBe(true);
      expect(wrapper.find('.event-log-section').exists()).toBe(true);
    });

    it('displays race status correctly', () => {
      const wrapper = mount(RaceInterface);

      expect(wrapper.text()).toContain('Lap 2/10');
      expect(wrapper.text()).toContain('2:55.086'); // Formatted race time
    });

    it('displays player position and status', () => {
      const wrapper = mount(RaceInterface);
      const myStatus = wrapper.find('[data-testid="my-status"]');

      expect(myStatus.text()).toContain('Your Position: #2');
      expect(myStatus.text()).toContain('146 km/h'); // Rounded speed
      expect(myStatus.text()).toContain('1:27.543'); // Formatted lap time
      expect(myStatus.text()).toContain('2:55.086'); // Formatted total time
      expect(myStatus.text()).toContain('accelerate 80'); // Last command
    });
  });

  describe('Command Input', () => {
    it('renders command input field and button', () => {
      const wrapper = mount(RaceInterface);

      expect(wrapper.find('[data-testid="command-input"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="send-command-button"]').exists()).toBe(true);
    });

    it('enables input when connected and in race', () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');
      const button = wrapper.find('[data-testid="send-command-button"]');

      expect(input.attributes('disabled')).toBeFalsy();
      expect(button.attributes('disabled')).toBeFalsy();
    });

    it('disables input when not connected', () => {
      websocketStore.isConnected = false;
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');
      const button = wrapper.find('[data-testid="send-command-button"]');

      expect(input.attributes('disabled')).toBeDefined();
      expect(button.attributes('disabled')).toBeDefined();
    });

    it('disables input when not in race', () => {
      gameStore.isInRace = false;
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');
      const button = wrapper.find('[data-testid="send-command-button"]');

      expect(input.attributes('disabled')).toBeDefined();
      expect(button.attributes('disabled')).toBeDefined();
    });

    it('validates accelerate command correctly', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('accelerate 75');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(false);
    });

    it('validates brake command correctly', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('brake 50');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(false);
    });

    it('validates shift command correctly', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('shift 4');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(false);
    });

    it('validates pit command correctly', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('pit tires');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(false);
    });

    it('shows error for invalid command', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('invalid command');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="command-error"]').text()).toContain('Unknown command');
    });

    it('shows error for invalid accelerate intensity', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('accelerate 150');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="command-error"]').text()).toContain('intensity must be between 0-100');
    });

    it('shows error for invalid gear', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('shift 10');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="command-error"]').text()).toContain('gear number (1-8)');
    });

    it('sends command on button click', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');
      const button = wrapper.find('[data-testid="send-command-button"]');

      await input.setValue('accelerate 80');
      await input.trigger('input');
      await button.trigger('click');

      expect(websocketStore.sendMessage).toHaveBeenCalledWith('race:command', expect.objectContaining({
        type: 'accelerate',
        parameters: { intensity: 80 },
        timestamp: expect.any(Number)
      }));
    });

    it('sends command on Enter key press', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('brake 60');
      await input.trigger('input');
      await input.trigger('keyup.enter');

      expect(websocketStore.sendMessage).toHaveBeenCalledWith('race:command', expect.objectContaining({
        type: 'brake',
        parameters: { intensity: 60 },
        timestamp: expect.any(Number)
      }));
    });

    it('clears input after sending command', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('shift 3');
      await input.trigger('input');
      await input.trigger('keyup.enter');

      expect((input.element as HTMLInputElement).value).toBe('');
    });
  });

  describe('Fuel and Tire Indicators', () => {
    it('displays fuel indicator with correct percentage', () => {
      const wrapper = mount(RaceInterface);
      const fuelIndicator = wrapper.find('[data-testid="fuel-indicator"]');

      expect(fuelIndicator.text()).toContain('65%');
    });

    it('displays tire wear indicators with correct percentages', () => {
      const wrapper = mount(RaceInterface);
      const tireIndicators = wrapper.find('[data-testid="tire-indicators"]');

      expect(tireIndicators.text()).toContain('25%'); // Front tires
      expect(tireIndicators.text()).toContain('30%'); // Rear tires
    });

    it('applies correct CSS classes for fuel status', () => {
      // Test good fuel level (65%)
      const wrapper = mount(RaceInterface);
      let fuelFill = wrapper.find('.fuel-fill');
      expect(fuelFill.classes()).toContain('good');

      // Test warning fuel level - create new wrapper with different data
      const warningGameStore = {
        ...gameStore,
        myParticipant: { ...mockParticipant, fuel: 20 }
      };
      vi.mocked(useGameStore).mockReturnValue(warningGameStore);
      const warningWrapper = mount(RaceInterface);
      fuelFill = warningWrapper.find('.fuel-fill');
      expect(fuelFill.classes()).toContain('warning');

      // Test critical fuel level - create new wrapper with different data
      const criticalGameStore = {
        ...gameStore,
        myParticipant: { ...mockParticipant, fuel: 5 }
      };
      vi.mocked(useGameStore).mockReturnValue(criticalGameStore);
      const criticalWrapper = mount(RaceInterface);
      fuelFill = criticalWrapper.find('.fuel-fill');
      expect(fuelFill.classes()).toContain('critical');
    });

    it('applies correct CSS classes for tire wear status', () => {
      // Test good tire wear (25%, 30%)
      const wrapper = mount(RaceInterface);
      let tireFills = wrapper.findAll('.tire-fill');
      tireFills.forEach(fill => {
        expect(fill.classes()).toContain('good');
      });

      // Test warning tire wear - create new wrapper with different data
      const warningGameStore = {
        ...gameStore,
        myParticipant: { 
          ...mockParticipant, 
          tireWear: { front: 80, rear: 85 }
        }
      };
      vi.mocked(useGameStore).mockReturnValue(warningGameStore);
      const warningWrapper = mount(RaceInterface);
      tireFills = warningWrapper.findAll('.tire-fill');
      tireFills.forEach(fill => {
        expect(fill.classes()).toContain('warning');
      });

      // Test critical tire wear - create new wrapper with different data
      const criticalGameStore = {
        ...gameStore,
        myParticipant: { 
          ...mockParticipant, 
          tireWear: { front: 95, rear: 98 }
        }
      };
      vi.mocked(useGameStore).mockReturnValue(criticalGameStore);
      const criticalWrapper = mount(RaceInterface);
      tireFills = criticalWrapper.findAll('.tire-fill');
      tireFills.forEach(fill => {
        expect(fill.classes()).toContain('critical');
      });
    });
  });

  describe('Race Positions Display', () => {
    it('displays all participants in correct order', () => {
      const wrapper = mount(RaceInterface);
      const positionsSection = wrapper.find('[data-testid="positions-section"]');
      const positionItems = positionsSection.findAll('.position-item');

      expect(positionItems).toHaveLength(2);
      expect(positionItems[0].text()).toContain('#1');
      expect(positionItems[0].text()).toContain('player-2');
      expect(positionItems[1].text()).toContain('#2');
      expect(positionItems[1].text()).toContain('player-1');
    });

    it('highlights current player position', () => {
      const wrapper = mount(RaceInterface);
      const positionItems = wrapper.findAll('.position-item');
      const myPositionItem = positionItems.find(item => item.classes().includes('my-position'));

      expect(myPositionItem).toBeDefined();
      expect(myPositionItem?.text()).toContain('player-1');
    });

    it('displays lap times and speeds correctly', () => {
      const wrapper = mount(RaceInterface);
      const positionItems = wrapper.findAll('.position-item');

      expect(positionItems[0].text()).toContain('1:25.123'); // Player 2 lap time
      expect(positionItems[0].text()).toContain('152 km/h'); // Player 2 speed
      expect(positionItems[1].text()).toContain('1:27.543'); // Player 1 lap time
      expect(positionItems[1].text()).toContain('146 km/h'); // Player 1 speed
    });
  });

  describe('Race Event Log', () => {
    it('displays race events in reverse chronological order', () => {
      const wrapper = mount(RaceInterface);
      const eventLog = wrapper.find('[data-testid="event-log"]');
      const eventItems = eventLog.findAll('.event-item');

      expect(eventItems).toHaveLength(2);
      // Events should be in reverse order (newest first)
      expect(eventItems[0].text()).toContain('Player-2 overtakes Player-1');
      expect(eventItems[1].text()).toContain('Player-1 completes lap 1');
    });

    it('applies correct CSS classes for event types', () => {
      const wrapper = mount(RaceInterface);
      const eventItems = wrapper.findAll('.event-item');

      expect(eventItems[0].classes()).toContain('event-overtake');
      expect(eventItems[1].classes()).toContain('event-lap_complete');
    });

    it('displays formatted timestamps', () => {
      const wrapper = mount(RaceInterface);
      const eventItems = wrapper.findAll('.event-item');

      expect(eventItems[0].text()).toContain('2:00.500'); // 120.5 seconds formatted
      expect(eventItems[1].text()).toContain('1:27.200'); // 87.2 seconds formatted
    });

    it('shows no events message when event log is empty', () => {
      gameStore.recentEvents = [];
      const wrapper = mount(RaceInterface);
      const eventLog = wrapper.find('[data-testid="event-log"]');

      expect(eventLog.text()).toContain('No race events yet...');
    });
  });

  describe('Utility Functions', () => {
    it('formats time correctly', () => {
      const wrapper = mount(RaceInterface);
      const component = wrapper.vm as any;

      expect(component.formatTime(0)).toBe('0:00.000');
      expect(component.formatTime(65.123)).toBe('1:05.123');
      expect(component.formatTime(125.456)).toBe('2:05.456');
      expect(component.formatTime(3661.789)).toBe('61:01.789');
    });

    it('handles negative time values', () => {
      const wrapper = mount(RaceInterface);
      const component = wrapper.vm as any;

      expect(component.formatTime(-10)).toBe('0:00.000');
    });

    it('returns correct fuel status classes', () => {
      const wrapper = mount(RaceInterface);
      const component = wrapper.vm as any;

      expect(component.getFuelStatusClass(50)).toBe('good');
      expect(component.getFuelStatusClass(20)).toBe('warning');
      expect(component.getFuelStatusClass(5)).toBe('critical');
    });

    it('returns correct tire status classes', () => {
      const wrapper = mount(RaceInterface);
      const component = wrapper.vm as any;

      expect(component.getTireStatusClass(50)).toBe('good');
      expect(component.getTireStatusClass(80)).toBe('warning');
      expect(component.getTireStatusClass(95)).toBe('critical');
    });
  });

  describe('Error Handling', () => {
    it('handles command parsing errors gracefully', async () => {
      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('accelerate abc');
      await input.trigger('input');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="command-error"]').text()).toContain('intensity must be between 0-100');
    });

    it('handles WebSocket send errors', async () => {
      websocketStore.sendMessage.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      const wrapper = mount(RaceInterface);
      const input = wrapper.find('[data-testid="command-input"]');

      await input.setValue('accelerate 50');
      await input.trigger('input');
      await input.trigger('keyup.enter');

      expect(wrapper.find('[data-testid="command-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="command-error"]').text()).toContain('WebSocket error');
    });
  });

  describe('Responsive Design', () => {
    it('maintains functionality on mobile viewport', () => {
      // This test would typically involve setting viewport size
      // For now, we just verify the component renders without errors
      const wrapper = mount(RaceInterface);
      expect(wrapper.find('.race-interface').exists()).toBe(true);
    });
  });
});