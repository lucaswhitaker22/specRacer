<template>
  <div id="app">
    <header class="app-header">
      <h1>Text Racing MMO</h1>
      <div class="connection-status" :class="{ connected: isConnected, disconnected: !isConnected }">
        {{ isConnected ? 'Connected' : 'Disconnected' }}
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
import { useWebSocketStore } from './stores/websocket'
import { useErrorStore } from './stores/error'
import ErrorNotification from './components/ErrorNotification.vue'

const websocketStore = useWebSocketStore()
const errorStore = useErrorStore()

const isConnected = computed(() => websocketStore.isConnected)

onMounted(() => {
  // Initialize WebSocket connection
  websocketStore.connect()
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