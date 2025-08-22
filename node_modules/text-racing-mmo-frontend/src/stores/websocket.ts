import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { WebSocketEvents, ConnectionState, ErrorMessage } from '@shared/types/websocket'
import type { RaceState, RaceEvent } from '@shared/types/index'
import type { RaceResult } from '@shared/types/player'
import type { CommandResult } from '@shared/types/commands'
import { useErrorStore } from './error'

export const useWebSocketStore = defineStore('websocket', () => {
  // State
  const socket = ref<Socket | null>(null)
  const connectionState = ref<ConnectionState>({
    isConnected: false,
    lastPing: 0
  })
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = ref(1000) // Start with 1 second
  const maxReconnectDelay = 30000 // Max 30 seconds

  // Getters
  const isConnected = computed(() => connectionState.value.isConnected)
  const playerId = computed(() => connectionState.value.playerId)
  const currentRaceId = computed(() => connectionState.value.currentRaceId)

  // Actions
  function connect() {
    if (socket.value?.connected) {
      return
    }

    const errorStore = useErrorStore()
    
    try {
      socket.value = io(import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001', {
        transports: ['websocket'],
        timeout: 5000,
        autoConnect: true
      })

      setupEventListeners()
    } catch (error) {
      errorStore.addError('Failed to initialize WebSocket connection', 'WEBSOCKET_INIT_ERROR')
    }
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    connectionState.value.isConnected = false
    connectionState.value.playerId = undefined
    connectionState.value.currentRaceId = undefined
  }

  function setupEventListeners() {
    if (!socket.value) return

    const errorStore = useErrorStore()

    // Connection events
    socket.value.on('connect', () => {
      connectionState.value.isConnected = true
      connectionState.value.lastPing = Date.now()
      reconnectAttempts.value = 0
      reconnectDelay.value = 1000
      errorStore.clearErrors()
    })

    socket.value.on('disconnect', (reason) => {
      connectionState.value.isConnected = false
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        errorStore.addError('Disconnected by server', 'SERVER_DISCONNECT')
      } else {
        // Client disconnect or network issue, attempt reconnection
        attemptReconnection()
      }
    })

    socket.value.on('connect_error', (error) => {
      connectionState.value.isConnected = false
      errorStore.addError(`Connection failed: ${error.message}`, 'CONNECTION_ERROR')
      attemptReconnection()
    })

    // Game events
    socket.value.on('connection:authenticated', (data: { playerId: string }) => {
      connectionState.value.playerId = data.playerId
    })

    socket.value.on('error', (error: ErrorMessage) => {
      errorStore.addError(error.message, error.code)
    })

    // Ping/pong for connection health
    socket.value.on('pong', () => {
      connectionState.value.lastPing = Date.now()
    })
  }

  function attemptReconnection() {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      const errorStore = useErrorStore()
      errorStore.addError('Maximum reconnection attempts reached', 'MAX_RECONNECT_EXCEEDED')
      return
    }

    reconnectAttempts.value++
    
    setTimeout(() => {
      if (!socket.value?.connected) {
        connect()
      }
    }, reconnectDelay.value)

    // Exponential backoff with jitter
    reconnectDelay.value = Math.min(
      reconnectDelay.value * 2 + Math.random() * 1000,
      maxReconnectDelay
    )
  }

  // Event emission helpers
  function emit<K extends keyof WebSocketEvents>(
    event: K,
    data: WebSocketEvents[K]
  ): boolean {
    if (!socket.value?.connected) {
      const errorStore = useErrorStore()
      errorStore.addError('Cannot send message: not connected', 'NOT_CONNECTED')
      return false
    }

    try {
      socket.value.emit(event, data)
      return true
    } catch (error) {
      const errorStore = useErrorStore()
      errorStore.addError(`Failed to send message: ${error}`, 'SEND_ERROR')
      return false
    }
  }

  // Event listener helpers
  function on<K extends keyof WebSocketEvents>(
    event: K,
    callback: (data: WebSocketEvents[K]) => void
  ) {
    socket.value?.on(event, callback)
  }

  function off<K extends keyof WebSocketEvents>(
    event: K,
    callback?: (data: WebSocketEvents[K]) => void
  ) {
    socket.value?.off(event, callback)
  }

  // Game-specific actions
  function joinRace(raceId: string) {
    if (emit('race:join', { raceId })) {
      connectionState.value.currentRaceId = raceId
    }
  }

  function leaveRace() {
    if (connectionState.value.currentRaceId) {
      emit('race:leave', { raceId: connectionState.value.currentRaceId })
      connectionState.value.currentRaceId = undefined
    }
  }

  function sendCommand(command: WebSocketEvents['race:command']) {
    return emit('race:command', command)
  }

  function sendMessage<K extends keyof WebSocketEvents>(
    event: K,
    data: WebSocketEvents[K]
  ) {
    return emit(event, data)
  }

  function authenticate(token: string) {
    return emit('player:authenticate', { token })
  }

  // Health check
  function ping() {
    if (socket.value?.connected) {
      socket.value.emit('ping')
    }
  }

  // Start periodic health checks
  setInterval(ping, 30000) // Ping every 30 seconds

  return {
    // State
    connectionState,
    reconnectAttempts,
    
    // Getters
    isConnected,
    playerId,
    currentRaceId,
    
    // Actions
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRace,
    leaveRace,
    sendCommand,
    sendMessage,
    authenticate,
    ping
  }
})