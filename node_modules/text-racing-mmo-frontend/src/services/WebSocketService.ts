import { io, Socket } from 'socket.io-client';
import type { WebSocketEvents, ConnectionState, ErrorMessage } from '@shared/types/websocket';
import type { RaceState, RaceEvent } from '@shared/types/index';
import { useErrorStore } from '../stores/error';

export interface WebSocketConfig {
  url: string;
  timeout: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
}

export interface ConnectionHealth {
  isConnected: boolean;
  lastPing: number;
  reconnectAttempts: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

/**
 * Enhanced WebSocket service with comprehensive error handling and recovery
 */
export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState = {
    isConnected: false,
    lastPing: 0
  };
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private errorStore = useErrorStore();
  private eventListeners = new Map<string, Function[]>();
  private messageQueue: Array<{ event: string; data: any }> = [];
  private connectionPromise: Promise<void> | null = null;

  constructor(config?: Partial<WebSocketConfig>) {
    this.config = {
      url: import.meta.env.VITE_WEBSOCKET_URL || '/ws',
      timeout: 5000,
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      ...config
    };
  }

  /**
   * Connect to WebSocket server with error handling
   */
  public async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    try {
      if (this.socket?.connected) {
        return;
      }

      this.socket = io(this.config.url, {
        transports: ['websocket'],
        timeout: this.config.timeout,
        autoConnect: false,
        forceNew: true
      });

      this.setupEventListeners();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          this.onConnected();
          resolve();
        });

        this.socket!.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.socket!.connect();
      });
    } catch (error) {
      this.connectionPromise = null;
      this.handleConnectionError(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.clearReconnectTimer();
    this.clearPingTimer();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionState.isConnected = false;
    this.connectionState.playerId = undefined;
    this.connectionState.currentRaceId = undefined;
    this.connectionPromise = null;
  }

  /**
   * Send message with automatic queuing and retry
   */
  public async send<K extends keyof WebSocketEvents>(
    event: K,
    data: WebSocketEvents[K],
    options: { retry?: boolean; timeout?: number } = {}
  ): Promise<boolean> {
    const { retry = true, timeout = 5000 } = options;

    // Queue message if not connected and retry is enabled
    if (!this.isConnected() && retry) {
      this.messageQueue.push({ event: event as string, data });
      
      // Try to reconnect
      try {
        await this.connect();
      } catch (error) {
        this.errorStore.addError(
          'Failed to send message: not connected',
          'SEND_FAILED_NOT_CONNECTED'
        );
        return false;
      }
    }

    if (!this.socket?.connected) {
      this.errorStore.addError(
        'Cannot send message: WebSocket not connected',
        'WEBSOCKET_NOT_CONNECTED'
      );
      return false;
    }

    try {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.errorStore.addWarning(
            'Message send timeout',
            'SEND_TIMEOUT'
          );
          resolve(false);
        }, timeout);

        this.socket!.emit(event as string, data, (ack?: any) => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    } catch (error) {
      this.errorStore.addError(
        `Failed to send message: ${(error as Error).message}`,
        'SEND_ERROR'
      );
      return false;
    }
  }

  /**
   * Add event listener with error handling
   */
  public on<K extends keyof WebSocketEvents>(
    event: K,
    callback: (data: WebSocketEvents[K]) => void
  ): void {
    const wrappedCallback = (data: any) => {
      try {
        callback(data);
      } catch (error) {
        this.errorStore.addError(
          `Event handler error for ${event as string}: ${(error as Error).message}`,
          'EVENT_HANDLER_ERROR'
        );
      }
    };

    if (!this.eventListeners.has(event as string)) {
      this.eventListeners.set(event as string, []);
    }
    this.eventListeners.get(event as string)!.push(wrappedCallback);

    this.socket?.on(event as string, wrappedCallback);
  }

  /**
   * Remove event listener
   */
  public off<K extends keyof WebSocketEvents>(
    event: K,
    callback?: (data: WebSocketEvents[K]) => void
  ): void {
    if (callback) {
      this.socket?.off(event as string, callback);
    } else {
      this.socket?.removeAllListeners(event as string);
      this.eventListeners.delete(event as string);
    }
  }

  /**
   * Get connection health information
   */
  public getConnectionHealth(): ConnectionHealth {
    const now = Date.now();
    const timeSinceLastPing = now - this.connectionState.lastPing;
    
    let connectionQuality: ConnectionHealth['connectionQuality'] = 'disconnected';
    
    if (this.connectionState.isConnected) {
      if (timeSinceLastPing < 5000) {
        connectionQuality = 'excellent';
      } else if (timeSinceLastPing < 15000) {
        connectionQuality = 'good';
      } else {
        connectionQuality = 'poor';
      }
    }

    return {
      isConnected: this.connectionState.isConnected,
      lastPing: this.connectionState.lastPing,
      reconnectAttempts: this.reconnectAttempts,
      connectionQuality
    };
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState.isConnected && this.socket?.connected === true;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Send race command
   */
  public async sendRaceCommand(raceId: string, command: string, parameters?: any): Promise<boolean> {
    return this.send('race:command', {
      raceId,
      command,
      parameters
    });
  }

  /**
   * Join race room
   */
  public async joinRaceRoom(raceId: string): Promise<boolean> {
    return this.send('race:join', { raceId });
  }

  /**
   * Leave race room
   */
  public async leaveRaceRoom(raceId: string): Promise<boolean> {
    return this.send('race:leave', { raceId });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.onConnected();
    });

    this.socket.on('disconnect', (reason) => {
      this.onDisconnected(reason);
    });

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error);
    });

    // Error handling
    this.socket.on('error', (error: ErrorMessage) => {
      this.errorStore.addError(error.message, error.code);
    });

    // Race recovery
    this.socket.on('race:recovered', (data: { message: string; recoveredState: RaceState }) => {
      this.errorStore.addInfo(data.message, 'RACE_RECOVERED');
      // Emit to listeners
      this.emit('race:recovered', data);
    });

    // Ping/pong for connection health
    this.socket.on('pong', () => {
      this.connectionState.lastPing = Date.now();
    });

    // Re-register custom event listeners
    for (const [event, callbacks] of this.eventListeners) {
      for (const callback of callbacks) {
        this.socket.on(event, callback);
      }
    }
  }

  private onConnected(): void {
    this.connectionState.isConnected = true;
    this.connectionState.lastPing = Date.now();
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
    
    this.clearReconnectTimer();
    this.startPingTimer();
    
    // Process queued messages
    this.processMessageQueue();
    
    this.errorStore.clearErrorsByCode('CONNECTION_ERROR');
    this.errorStore.clearErrorsByCode('WEBSOCKET_NOT_CONNECTED');
    
    this.emit('connection:established', {});
  }

  private onDisconnected(reason: string): void {
    this.connectionState.isConnected = false;
    this.clearPingTimer();
    
    if (reason === 'io server disconnect') {
      // Server initiated disconnect
      this.errorStore.addError(
        'Disconnected by server',
        'SERVER_DISCONNECT'
      );
    } else {
      // Client disconnect or network issue
      this.errorStore.addWarning(
        `Connection lost: ${reason}`,
        'CONNECTION_LOST'
      );
      this.attemptReconnection();
    }
    
    this.emit('connection:lost', { reason });
  }

  private handleConnectionError(error: Error): void {
    this.connectionState.isConnected = false;
    this.connectionPromise = null;
    
    this.errorStore.addError(
      `Connection failed: ${error.message}`,
      'CONNECTION_ERROR'
    );
    
    this.attemptReconnection();
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.errorStore.addError(
        'Maximum reconnection attempts reached',
        'MAX_RECONNECT_EXCEEDED'
      );
      return;
    }

    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    this.errorStore.addInfo(
      `Reconnecting in ${delay / 1000} seconds... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`,
      'RECONNECT_ATTEMPT'
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Error already handled in connect method
      });
    }, delay);
  }

  private processMessageQueue(): void {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const { event, data } of queue) {
      this.send(event as keyof WebSocketEvents, data, { retry: false });
    }
  }

  private startPingTimer(): void {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          this.errorStore.addError(
            `Event emission error: ${(error as Error).message}`,
            'EVENT_EMIT_ERROR'
          );
        }
      }
    }
  }
}