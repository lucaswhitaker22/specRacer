<template>
  <div id="app">
    <header class="app-header">
      <h1>Text Racing MMO</h1>
      <div class="header-right">
        <div v-if="currentPlayer" class="user-info">
          Welcome, {{ currentPlayer.username }}!
          <button @click="handleLogout" class="logout-button">Logout</button>
        </div>
        <div class="connection-status" :class="{ connected: isConnected, disconnected: !isConnected }">
          {{ isConnected ? 'Connected' : 'Disconnected' }}
        </div>
      </div>
    </header>

    <main class="app-main">
      <ErrorNotification />
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocketStore } from './stores/websocket'
import { useErrorStore } from './stores/error'
import { usePlayerStore } from './stores/player'
import ErrorNotification from './components/ErrorNotification.vue'

const router = useRouter()
const websocketStore = useWebSocketStore()
const errorStore = useErrorStore()
const playerStore = usePlayerStore()

const isConnected = computed(() => websocketStore.isConnected)
const currentPlayer = computed(() => playerStore.currentPlayer)

const handleLogout = () => {
  playerStore.logout()
  websocketStore.disconnect()
  router.push('/login')
}

onMounted(() => {
  // Initialize WebSocket connection only if authenticated
  if (playerStore.isAuthenticated) {
    websocketStore.connect()
  }
})

onUnmounted(() => {
  // Clean up WebSocket connection
  websocketStore.disconnect()
})
</script>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: #2c3e50;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
}

.logout-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.logout-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.connection-status {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.connection-status.connected {
  background-color: #27ae60;
  color: white;
}

.connection-status.disconnected {
  background-color: #e74c3c;
  color: white;
}

.app-main {
  flex: 1;
  padding: 2rem;
}
</style>