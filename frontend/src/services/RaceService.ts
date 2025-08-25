import type { RaceState } from '@shared/types/index'
import { usePlayerStore } from '../stores/player'

export interface CreateRaceRequest {
  trackId: string
  totalLaps: number
  maxParticipants?: number
}

export interface JoinRaceRequest {
  carId: string
}

export interface RaceInfo {
  raceId: string
  trackId: string
  totalLaps: number
  maxParticipants: number
  currentParticipants: number
  status: 'waiting' | 'active' | 'finished'
}

export class RaceService {
  private static instance: RaceService
  private baseUrl = `${import.meta.env.VITE_API_BASE_URL || '/api'}/races`

  static getInstance(): RaceService {
    if (!RaceService.instance) {
      RaceService.instance = new RaceService()
    }
    return RaceService.instance
  }

  private getAuthHeaders(): Record<string, string> {
    const playerStore = usePlayerStore()
    return {
      'Content-Type': 'application/json',
      ...playerStore.getAuthHeaders()
    }
  }

  async createRace(request: CreateRaceRequest): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create race')
    }

    const data = await response.json()
    return data.raceId
  }

  async joinRace(raceId: string, request: JoinRaceRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${raceId}/join`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to join race')
    }
  }

  async leaveRace(raceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${raceId}/leave`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to leave race')
    }
  }

  async startRace(raceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${raceId}/start`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start race')
    }
  }

  async getRaceState(raceId: string): Promise<RaceState | null> {
    const response = await fetch(`${this.baseUrl}/${raceId}`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      const error = await response.json()
      throw new Error(error.error || 'Failed to get race state')
    }

    const data = await response.json()
    return data.raceState
  }

  async getAvailableRaces(): Promise<RaceInfo[]> {
    const response = await fetch(this.baseUrl, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get available races')
    }

    const data = await response.json()
    return data.races
  }

  async getRaceResults(raceId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${raceId}/results`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      const error = await response.json()
      throw new Error(error.error || 'Failed to get race results')
    }

    const data = await response.json()
    return data.results
  }
}