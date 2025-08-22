<template>
  <div class="car-selection-view">
    <div class="header">
      <h1>Select Your Car</h1>
      <p>Choose from authentic car models with real specifications</p>
      
      <div v-if="!isConnected" class="connection-warning">
        ⚠️ Not connected to server. Car data may not be available.
      </div>
    </div>

    <CarSelection 
      @car-selected="onCarSelected"
      @selection-cleared="onSelectionCleared"
    />

    <div v-if="selectedCar" class="selection-summary">
      <h3>Selected Car</h3>
      <div class="selected-car-info">
        <h4>{{ selectedCar.manufacturer }} {{ selectedCar.name }} ({{ selectedCar.year }})</h4>
        <div class="quick-specs">
          <span>{{ selectedCar.specifications.horsepower }} HP</span>
          <span>{{ selectedCar.specifications.weight }} kg</span>
          <span>{{ selectedCar.specifications.drivetrain }}</span>
          <span>0-60: {{ selectedCar.specifications.zeroToSixty }}s</span>
        </div>
      </div>
      
      <div class="selection-actions">
        <button @click="proceedToRace" class="proceed-button">
          Proceed to Race
        </button>
        <button @click="clearSelection" class="clear-button">
          Change Car
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import CarSelection from '../components/CarSelection.vue';
import { useWebSocketStore } from '../stores/websocket';
import { useGameStore } from '../stores/game';
import { useErrorStore } from '../stores/error';
import type { CarModel } from '@shared/types/index';

const router = useRouter();
const websocketStore = useWebSocketStore();
const gameStore = useGameStore();
const errorStore = useErrorStore();

const isConnected = computed(() => websocketStore.isConnected);
const selectedCar = computed(() => gameStore.selectedCar);

const onCarSelected = (car: CarModel) => {
  console.log('Car selected:', car);
};

const onSelectionCleared = () => {
  console.log('Car selection cleared');
};

const proceedToRace = () => {
  if (!selectedCar.value) {
    errorStore.addError('No Car Selected', 'Please select a car before proceeding to race');
    return;
  }
  
  // Navigate to race view
  router.push('/race');
};

const clearSelection = () => {
  gameStore.selectCar(null);
};
</script>

<style scoped>
.car-selection-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
  font-size: 2.5rem;
  font-weight: 700;
}

.header p {
  color: #7f8c8d;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.connection-warning {
  background-color: #fff8e1;
  border: 1px solid #f39c12;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 2rem;
  color: #e67e22;
  text-align: center;
}

.selection-summary {
  margin-top: 3rem;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  text-align: center;
}

.selection-summary h3 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.selected-car-info {
  margin-bottom: 2rem;
}

.selected-car-info h4 {
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
  font-weight: 700;
}

.quick-specs {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.quick-specs span {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 500;
  font-size: 0.9rem;
}

.selection-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.proceed-button {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.proceed-button:hover {
  background-color: #218838;
  transform: translateY(-2px);
}

.clear-button {
  background-color: transparent;
  color: white;
  border: 2px solid white;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-button:hover {
  background-color: white;
  color: #667eea;
}

@media (max-width: 768px) {
  .car-selection-view {
    padding: 1rem;
  }
  
  .header h1 {
    font-size: 2rem;
  }
  
  .quick-specs {
    gap: 1rem;
  }
  
  .quick-specs span {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }
  
  .selection-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .proceed-button,
  .clear-button {
    width: 100%;
    max-width: 300px;
  }
}
</style>