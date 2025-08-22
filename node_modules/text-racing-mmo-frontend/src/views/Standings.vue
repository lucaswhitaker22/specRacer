<template>
  <div class="standings">
    <h2>League Standings</h2>
    <p>View current league positions and race history</p>
    
    <div v-if="!isConnected" class="connection-warning">
      ⚠️ Not connected to server. Standings data may not be current.
    </div>

    <div class="standings-placeholder">
      <h3>🏆 League Standings</h3>
      <p>Standings interface will be implemented in task 13</p>
      <p>This foundation provides the routing and basic structure</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWebSocketStore } from '../stores/websocket'

const websocketStore = useWebSocketStore()
const isConnected = computed(() => websocketStore.isConnected)
</script>

<style scoped>
.standings {
  max-width: 1200px;
  margin: 0 auto;
}

.standings h2 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.standings p {
  color: #7f8c8d;
  margin-bottom: 2rem;
}

.connection-warning {
  background-color: #fff8e1;
  border: 1px solid #f39c12;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 2rem;
  color: #e67e22;
}

.standings-placeholder {
  background: #f8f9fa;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 3rem 2rem;
  text-align: center;
  color: #6c757d;
}

.standings-placeholder h3 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}
</style>