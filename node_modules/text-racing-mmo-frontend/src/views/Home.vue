<template>
  <div class="home">
    <div class="hero">
      <h1>Text Racing MMO</h1>
      <p>Experience the thrill of racing through strategic text commands</p>
    </div>

    <div class="navigation-cards">
      <router-link to="/car-selection" class="nav-card">
        <h3>🏎️ Select Car</h3>
        <p>Choose from authentic car models with real specifications</p>
      </router-link>

      <router-link to="/race" class="nav-card">
        <h3>🏁 Race</h3>
        <p>Join a race and compete against other players</p>
      </router-link>

      <router-link to="/standings" class="nav-card">
        <h3>🏆 Standings</h3>
        <p>View league standings and race history</p>
      </router-link>
    </div>

    <div class="race-management">
      <h2>Quick Race</h2>
      <p>Start a new race or join an existing one</p>
      
      <div class="race-actions">
        <button @click="createQuickRace" :disabled="isCreatingRace" class="create-race-btn">
          {{ isCreatingRace ? 'Creating...' : 'Create New Race' }}
        </button>
        
        <div v-if="availableRaces.length > 0" class="available-races">
          <h3>Available Races</h3>
          <div class="race-list">
            <div v-for="race in availableRaces" :key="race.raceId" class="race-item">
              <div class="race-info">
                <strong>{{ race.trackId }}</strong>
                <span>{{ race.currentParticipants }}/{{ race.maxParticipants }} players</span>
                <span>{{ race.totalLaps }} laps</span>
              </div>
              <button @click="joinRace(race.raceId)" class="join-race-btn">
                Join Race
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="connection-info">
      <div v-if="isConnected" class="status-connected">
        ✅ Connected to game server
      </div>
      <div v-else class="status-disconnected">
        ❌ Not connected to game server
        <button @click="reconnect" class="reconnect-btn">Reconnect</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocketStore } from '../stores/websocket'
import { useGameStore } from '../stores/game'
import { useErrorStore } from '../stores/error'
import { RaceService } from '../services/RaceService'
import type { RaceInfo } from '../services/RaceService'

const router = useRouter()
const websocketStore = useWebSocketStore()
const gameStore = useGameStore()
const errorStore = useErrorStore()
const raceService = RaceService.getInstance()

const isConnected = computed(() => websocketStore.isConnected)
const selectedCar = computed(() => gameStore.selectedCar)

const isCreatingRace = ref(false)
const availableRaces = ref<RaceInfo[]>([])

function reconnect() {
  websocketStore.connect()
}

const createQuickRace = async () => {
  if (!selectedCar.value) {
    errorStore.addError('No Car Selected', 'Please select a car before creating a race')
    router.push('/car-selection')
    return
  }

  isCreatingRace.value = true
  
  try {
    const raceId = await raceService.createRace({
      trackId: 'default', // Let backend handle default track
      totalLaps: 5,
      maxParticipants: 8
    })

    // Join the race we just created
    await raceService.joinRace(raceId, {
      carId: selectedCar.value.id
    })

    // Navigate to race view
    router.push('/race')
  } catch (error) {
    errorStore.addError('Race Creation Failed', error instanceof Error ? error.message : 'Failed to create race')
  } finally {
    isCreatingRace.value = false
  }
}

const joinRace = async (raceId: string) => {
  if (!selectedCar.value) {
    errorStore.addError('No Car Selected', 'Please select a car before joining a race')
    router.push('/car-selection')
    return
  }

  try {
    await raceService.joinRace(raceId, {
      carId: selectedCar.value.id
    })

    // Navigate to race view
    router.push('/race')
  } catch (error) {
    errorStore.addError('Join Race Failed', error instanceof Error ? error.message : 'Failed to join race')
  }
}

const loadAvailableRaces = async () => {
  try {
    availableRaces.value = await raceService.getAvailableRaces()
  } catch (error) {
    console.error('Failed to load available races:', error)
  }
}

onMounted(() => {
  loadAvailableRaces()
  
  // Refresh available races every 10 seconds
  setInterval(loadAvailableRaces, 10000)
})
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.hero {
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.2rem;
  color: #7f8c8d;
}

.navigation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.nav-card {
  background: white;
  border: 2px solid #ecf0f1;
  border-radius: 8px;
  padding: 2rem;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;
}

.nav-card:hover {
  border-color: #3498db;
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.15);
}

.nav-card h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.nav-card p {
  margin: 0;
  color: #7f8c8d;
  line-height: 1.5;
}

.connection-info {
  padding: 1rem;
  border-radius: 6px;
  font-weight: 500;
}

.status-connected {
  color: #27ae60;
  background-color: #d5f4e6;
}

.status-disconnected {
  color: #e74c3c;
  background-color: #fdeaea;
}

.reconnect-btn {
  margin-left: 1rem;
  padding: 0.5rem 1rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.reconnect-btn:hover {
  background-color: #2980b9;
}

.race-management {
  margin-top: 3rem;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid #e9ecef;
}

.race-management h2 {
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
}

.race-management > p {
  color: #7f8c8d;
  margin-bottom: 2rem;
}

.race-actions {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.create-race-btn {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.create-race-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.create-race-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.available-races h3 {
  color: #2c3e50;
  margin: 0 0 1rem 0;
  font-size: 1.3rem;
}

.race-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.race-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  transition: all 0.2s;
}

.race-item:hover {
  border-color: #3498db;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.1);
}

.race-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.race-info strong {
  color: #2c3e50;
  font-size: 1.1rem;
}

.race-info span {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.join-race-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.join-race-btn:hover {
  background: #2980b9;
}

@media (max-width: 768px) {
  .race-management {
    padding: 1rem;
  }
  
  .race-item {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .join-race-btn {
    width: 100%;
  }
}
</style>