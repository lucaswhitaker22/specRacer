import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWebSocketStore } from '../websocket'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn()
  }))
}))

describe('WebSocket Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with disconnected state', () => {
    const websocketStore = useWebSocketStore()
    
    expect(websocketStore.isConnected).toBe(false)
    expect(websocketStore.playerId).toBeUndefined()
    expect(websocketStore.currentRaceId).toBeUndefined()
  })

  it('should handle connection state changes', () => {
    const websocketStore = useWebSocketStore()
    
    // Simulate connection
    websocketStore.connectionState.isConnected = true
    websocketStore.connectionState.playerId = 'player-123'
    
    expect(websocketStore.isConnected).toBe(true)
    expect(websocketStore.playerId).toBe('player-123')
  })

  it('should manage race participation', () => {
    const websocketStore = useWebSocketStore()
    
    websocketStore.connectionState.currentRaceId = 'race-456'
    
    expect(websocketStore.currentRaceId).toBe('race-456')
  })

  it('should track reconnection attempts', () => {
    const websocketStore = useWebSocketStore()
    
    expect(websocketStore.reconnectAttempts).toBe(0)
    
    // Simulate failed reconnection attempts
    websocketStore.reconnectAttempts = 3
    
    expect(websocketStore.reconnectAttempts).toBe(3)
  })
})