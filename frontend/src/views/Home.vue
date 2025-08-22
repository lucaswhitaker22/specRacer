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
import { computed } from 'vue'
import { useWebSocketStore } from '../stores/websocket'

const websocketStore = useWebSocketStore()

const isConnected = computed(() => websocketStore.isConnected)

function reconnect() {
  websocketStore.connect()
}
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
</style>