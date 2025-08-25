<template>
  <div class="league-standings">
    <div class="standings-header">
      <h2>League Standings</h2>
      <div class="view-controls">
        <button 
          :class="{ active: currentView === 'standings' }"
          @click="currentView = 'standings'"
        >
          Standings
        </button>
        <button 
          :class="{ active: currentView === 'history' }"
          @click="currentView = 'history'"
        >
          Race History
        </button>
        <button 
          :class="{ active: currentView === 'statistics' }"
          @click="currentView = 'statistics'"
        >
          Statistics
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading">
      Loading...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error">
      {{ error }}
      <button @click="refreshData" class="retry-button">Retry</button>
    </div>

    <!-- League Standings View -->
    <div v-else-if="currentView === 'standings'" class="standings-view">
      <div class="standings-table">
        <div class="table-header">
          <div class="position">Pos</div>
          <div class="username">Player</div>
          <div class="points">Points</div>
          <div class="races">Races</div>
          <div class="wins">Wins</div>
        </div>
        <div 
          v-for="standing in standings" 
          :key="standing.playerId"
          :class="['table-row', { 'current-player': isCurrentPlayer(standing.playerId) }]"
        >
          <div class="position">{{ standing.position }}</div>
          <div class="username">{{ standing.username }}</div>
          <div class="points">{{ standing.leaguePoints }}</div>
          <div class="races">{{ standing.totalRaces }}</div>
          <div class="wins">{{ standing.wins }}</div>
        </div>
      </div>
      
      <div v-if="standings.length === 0" class="empty-state">
        No league standings available yet.
      </div>
    </div>

    <!-- Race History View -->
    <div v-else-if="currentView === 'history'" class="history-view">
      <div class="history-table">
        <div class="table-header">
          <div class="date">Date</div>
          <div class="position">Position</div>
          <div class="time">Time</div>
          <div class="points">Points</div>
          <div class="car">Car</div>
        </div>
        <div 
          v-for="race in raceHistory" 
          :key="race.raceId"
          class="table-row"
        >
          <div class="date">{{ formatDate(race.completedAt) }}</div>
          <div class="position">{{ race.finalPosition }}</div>
          <div class="time">{{ formatTime(race.finalTime) }}</div>
          <div class="points">{{ race.points }}</div>
          <div class="car">{{ getCarName(race.carId) }}</div>
        </div>
      </div>
      
      <div v-if="raceHistory.length === 0" class="empty-state">
        No race history available yet.
      </div>
    </div>

    <!-- Statistics View -->
    <div v-else-if="currentView === 'statistics'" class="statistics-view">
      <div v-if="statistics" class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Average Position</div>
          <div class="stat-value">{{ statistics.averagePosition.toFixed(1) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Podium Finishes</div>
          <div class="stat-value">{{ statistics.podiumFinishes }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">DNF Count</div>
          <div class="stat-value">{{ statistics.dnfCount }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Race Time</div>
          <div class="stat-value">{{ formatTime(statistics.totalRaceTime) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Best Lap Time</div>
          <div class="stat-value">{{ formatTime(statistics.bestLapTime) || 'N/A' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Average Lap Time</div>
          <div class="stat-value">{{ formatTime(statistics.averageLapTime) || 'N/A' }}</div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        No statistics available yet.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { PlayerService } from '../services/PlayerService';
import type { LeagueStanding } from '@shared/types/player';
import type { RaceResult, PlayerStatistics } from '@shared/types/player';
import type { CarModel } from '@shared/types/index';
import { useGameStore } from '../stores/game';

// Props
interface Props {
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  refreshInterval: 30000 // 30 seconds
});

// State
const currentView = ref<'standings' | 'history' | 'statistics'>('standings');
const isLoading = ref(false);
const error = ref<string | null>(null);
const standings = ref<LeagueStanding[]>([]);
const raceHistory = ref<RaceResult[]>([]);
const statistics = ref<PlayerStatistics | null>(null);

// Store
const gameStore = useGameStore();

// Computed
const currentPlayerId = computed(() => {
  // This would come from authentication store when implemented
  return localStorage.getItem('currentPlayerId') || null;
});

// Methods
const isCurrentPlayer = (playerId: string): boolean => {
  return playerId === currentPlayerId.value;
};

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (timeInSeconds: number): string => {
  if (!timeInSeconds || timeInSeconds === 0) return 'N/A';
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = (timeInSeconds % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
};

const getCarName = (carId: string): string => {
  const car = gameStore.availableCars.find((c: CarModel) => c.id === carId);
  return car ? `${car.manufacturer} ${car.name}` : 'Unknown Car';
};

const loadStandings = async (): Promise<void> => {
  try {
    const data = await PlayerService.getLeagueStandings(50);
    standings.value = data;
  } catch (err) {
    console.error('Failed to load standings:', err);
    throw err;
  }
};

const loadRaceHistory = async (): Promise<void> => {
  try {
    const data = await PlayerService.getPlayerRaceHistory(50);
    raceHistory.value = data;
  } catch (err) {
    console.error('Failed to load race history:', err);
    // Don't throw for race history as it requires authentication
    if (err instanceof Error && err.message.includes('Authentication required')) {
      raceHistory.value = [];
    } else {
      throw err;
    }
  }
};

const loadStatistics = async (): Promise<void> => {
  try {
    const data = await PlayerService.getPlayerStatistics();
    statistics.value = data;
  } catch (err) {
    console.error('Failed to load statistics:', err);
    // Don't throw for statistics as it requires authentication
    if (err instanceof Error && err.message.includes('Authentication required')) {
      statistics.value = null;
    } else {
      throw err;
    }
  }
};

const refreshData = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;

  try {
    await Promise.all([
      loadStandings(),
      loadRaceHistory(),
      loadStatistics()
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  } finally {
    isLoading.value = false;
  }
};

// Lifecycle
onMounted(async () => {
  await refreshData();
  
  // Set up auto-refresh for standings
  if (props.refreshInterval > 0) {
    setInterval(async () => {
      if (currentView.value === 'standings') {
        try {
          await loadStandings();
        } catch (err) {
          console.error('Auto-refresh failed:', err);
        }
      }
    }, props.refreshInterval);
  }
});

// Expose methods for testing
defineExpose({
  refreshData,
  loadStandings,
  loadRaceHistory,
  loadStatistics
});
</script>

<style scoped>
.league-standings {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.standings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.standings-header h2 {
  margin: 0;
  color: #333;
}

.view-controls {
  display: flex;
  gap: 10px;
}

.view-controls button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.view-controls button:hover {
  background: #f5f5f5;
}

.view-controls button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  text-align: center;
  padding: 40px;
  color: #d32f2f;
}

.retry-button {
  margin-left: 10px;
  padding: 4px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-button:hover {
  background: #0056b3;
}

.standings-table,
.history-table {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  background: #f8f9fa;
  font-weight: bold;
  padding: 12px;
  border-bottom: 1px solid #ddd;
}

.standings-table .table-header {
  grid-template-columns: 60px 1fr 100px 80px 80px;
}

.history-table .table-header {
  grid-template-columns: 120px 80px 120px 80px 1fr;
}

.table-row {
  display: grid;
  padding: 12px;
  border-bottom: 1px solid #eee;
  transition: background-color 0.2s;
}

.table-row:hover {
  background: #f8f9fa;
}

.table-row:last-child {
  border-bottom: none;
}

.standings-table .table-row {
  grid-template-columns: 60px 1fr 100px 80px 80px;
}

.history-table .table-row {
  grid-template-columns: 120px 80px 120px 80px 1fr;
}

.current-player {
  background: #e3f2fd;
  font-weight: bold;
}

.current-player:hover {
  background: #bbdefb;
}

.position {
  text-align: center;
}

.username {
  font-weight: 500;
}

.points,
.races,
.wins,
.time {
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}

@media (max-width: 768px) {
  .standings-header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .view-controls {
    justify-content: center;
  }

  .standings-table .table-header,
  .standings-table .table-row {
    grid-template-columns: 50px 1fr 70px 60px 60px;
    font-size: 14px;
  }

  .history-table .table-header,
  .history-table .table-row {
    grid-template-columns: 100px 60px 100px 60px 1fr;
    font-size: 14px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>