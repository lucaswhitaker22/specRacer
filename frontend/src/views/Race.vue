<template>
  <div class="race">
    <h2>Race Interface</h2>
    
    <div v-if="!isConnected" class="connection-warning">
      ⚠️ Not connected to server. Racing functionality unavailable.
      <button @click="connect" class="connect-button">Connect</button>
    </div>

    <div v-else-if="!isInRace" class="no-race">
      <h3>🏁 No Active Race</h3>
      <p>Join a race to start racing!</p>
      <p>The race interface will be available once you're in an active race.</p>
    </div>

    <div v-else class="race-active">
      <RaceInterface />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWebSocketStore } from '../stores/websocket'
import { useGameStore } from '../stores/game'
import RaceInterface from '../components/RaceInterface.vue'

const websocketStore = useWebSocketStore()
const gameStore = useGameStore()

const isConnected = computed(() => websocketStore.isConnected)
const isInRace = computed(() => gameStore.isInRace)

function connect() {
  websocketStore.connect()
}

onMounted(() => {
  // Auto-connect when component mounts
  if (!isConnected.value) {
    connect()
  }
})
</script>

<style scoped>
.race {
  max-width: 1200px;
  margin: 0 auto;
}

.race h2 {
  color: #2c3e50;
  margin-bottom: 2rem;
}

.connection-warning {
  background-color: #fdeaea;
  border: 1px solid #e74c3c;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 2rem;
  color: #c0392b;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connect-button {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.connect-button:hover {
  background: #c0392b;
}

.no-race,
.race-active {
  background: #f8f9fa;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 3rem 2rem;
  text-align: center;
  color: #6c757d;
}

.no-race h3,
.race-active h3 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}
</style>