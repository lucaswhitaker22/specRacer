import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '../game'
import type { RaceState, RaceEvent, CarModel } from '@shared/types/index'

describe('Game Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty state', () => {
    const gameStore = useGameStore()
    
    expect(gameStore.currentRace).toBeNull()
    expect(gameStore.raceHistory).toEqual([])
    expect(gameStore.availableCars).toEqual([])
    expect(gameStore.selectedCar).toBeNull()
    expect(gameStore.isInRace).toBe(false)
  })

  it('should update race state', () => {
    const gameStore = useGameStore()
    
    const mockRaceState: RaceState = {
      raceId: 'race-1',
      trackId: 'track-1',
      currentLap: 1,
      totalLaps: 10,
      raceTime: 60,
      participants: [],
      raceEvents: [],
      weather: {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        precipitation: 0,
        visibility: 1000
      },
      trackConditions: {
        surface: 'dry',
        grip: 1.0,
        temperature: 25
      }
    }
    
    gameStore.updateRaceState(mockRaceState)
    
    expect(gameStore.currentRace).toEqual(mockRaceState)
    expect(gameStore.isInRace).toBe(true)
  })

  it('should add race events', () => {
    const gameStore = useGameStore()
    
    const mockEvent: RaceEvent = {
      id: 'event-1',
      timestamp: Date.now(),
      type: 'race_start',
      description: 'Race has started',
      involvedPlayers: []
    }
    
    gameStore.addRaceEvent(mockEvent)
    
    expect(gameStore.raceHistory).toHaveLength(1)
    expect(gameStore.raceHistory[0]).toEqual(mockEvent)
  })

  it('should limit race history to 100 events', () => {
    const gameStore = useGameStore()
    
    // Add 105 events
    for (let i = 0; i < 105; i++) {
      gameStore.addRaceEvent({
        id: `event-${i}`,
        timestamp: Date.now(),
        type: 'lap_complete',
        description: `Event ${i}`,
        involvedPlayers: []
      })
    }
    
    expect(gameStore.raceHistory).toHaveLength(100)
    expect(gameStore.raceHistory[0].id).toBe('event-5') // First 5 should be removed
  })

  it('should select cars', () => {
    const gameStore = useGameStore()
    
    const mockCar: CarModel = {
      id: 'car-1',
      name: 'Test Car',
      manufacturer: 'Test Motors',
      year: 2023,
      specifications: {
        horsepower: 300,
        weight: 1500,
        dragCoefficient: 0.3,
        frontalArea: 2.5,
        drivetrain: 'RWD',
        tireGrip: 1.0,
        gearRatios: [3.5, 2.1, 1.4, 1.0, 0.8],
        aeroDownforce: 100,
        fuelEconomy: 10,
        zeroToSixty: 5.5,
        topSpeed: 250
      },
      licensing: {
        source: 'Test License',
        validUntil: new Date(),
        restrictions: []
      }
    }
    
    gameStore.selectCar(mockCar)
    
    expect(gameStore.selectedCar).toEqual(mockCar)
  })

  it('should reset game state', () => {
    const gameStore = useGameStore()
    
    // Set some state
    gameStore.isInRace = true
    gameStore.addRaceEvent({
      id: 'event-1',
      timestamp: Date.now(),
      type: 'race_start',
      description: 'Test event',
      involvedPlayers: []
    })
    
    gameStore.resetGameState()
    
    expect(gameStore.currentRace).toBeNull()
    expect(gameStore.raceHistory).toEqual([])
    expect(gameStore.isInRace).toBe(false)
    expect(gameStore.selectedCar).toBeNull()
  })
})