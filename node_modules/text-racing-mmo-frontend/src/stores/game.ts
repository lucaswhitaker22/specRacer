import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RaceState, RaceEvent, CarModel } from '@shared/types/index'
import type { RaceResult } from '@shared/types/player'

export const useGameStore = defineStore('game', () => {
  // State
  const currentRace = ref<RaceState | null>(null)
  const raceHistory = ref<RaceEvent[]>([])
  const availableCars = ref<CarModel[]>([])
  const selectedCar = ref<CarModel | null>(null)
  const raceResults = ref<RaceResult[]>([])
  const isInRace = ref(false)

  // Getters
  const myParticipant = computed(() => {
    if (!currentRace.value) return null
    // This will be populated when we have player authentication
    return currentRace.value.participants.find(p => p.playerId === 'current-player-id')
  })

  const racePosition = computed(() => myParticipant.value?.position || 0)
  
  const raceProgress = computed(() => {
    if (!currentRace.value) return 0
    return (currentRace.value.currentLap / currentRace.value.totalLaps) * 100
  })

  const sortedParticipants = computed(() => {
    if (!currentRace.value) return []
    return [...currentRace.value.participants].sort((a, b) => a.position - b.position)
  })

  const recentEvents = computed(() => {
    return raceHistory.value.slice(-10).reverse() // Last 10 events, newest first
  })

  // Actions
  function updateRaceState(raceState: RaceState) {
    currentRace.value = raceState
    isInRace.value = true
  }

  function addRaceEvent(event: RaceEvent) {
    raceHistory.value.push(event)
    
    // Keep only last 100 events to prevent memory issues
    if (raceHistory.value.length > 100) {
      raceHistory.value = raceHistory.value.slice(-100)
    }
  }

  function completeRace(result: RaceResult) {
    raceResults.value.push(result)
    isInRace.value = false
    
    // Keep only last 20 race results
    if (raceResults.value.length > 20) {
      raceResults.value = raceResults.value.slice(-20)
    }
  }

  function setAvailableCars(cars: CarModel[]) {
    availableCars.value = cars
  }

  function selectCar(car: CarModel | null) {
    selectedCar.value = car
  }

  function clearRaceData() {
    currentRace.value = null
    raceHistory.value = []
    isInRace.value = false
  }

  function resetGameState() {
    currentRace.value = null
    raceHistory.value = []
    raceResults.value = []
    selectedCar.value = null
    isInRace.value = false
  }

  return {
    // State
    currentRace,
    raceHistory,
    availableCars,
    selectedCar,
    raceResults,
    isInRace,
    
    // Getters
    myParticipant,
    racePosition,
    raceProgress,
    sortedParticipants,
    recentEvents,
    
    // Actions
    updateRaceState,
    addRaceEvent,
    completeRace,
    setAvailableCars,
    selectCar,
    clearRaceData,
    resetGameState
  }
})