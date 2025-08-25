import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Player, LoginCredentials, RegisterData } from '@shared/types/player'

interface AuthToken {
  token: string
  expiresAt: string
  player: Player
}

export const usePlayerStore = defineStore('player', () => {
  const currentPlayer = ref<Player | null>(null)
  const authToken = ref<string | null>(null)
  const tokenExpiry = ref<Date | null>(null)

  const isAuthenticated = computed(() => {
    return !!(currentPlayer.value && authToken.value && tokenExpiry.value && tokenExpiry.value > new Date())
  })

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Login failed')
      }

      const data: AuthToken = await response.json()
      
      currentPlayer.value = data.player
      authToken.value = data.token
      tokenExpiry.value = new Date(data.expiresAt)

      // Store in localStorage for persistence
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('tokenExpiry', data.expiresAt)
      localStorage.setItem('currentPlayer', JSON.stringify(data.player))
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const register = async (registerData: RegisterData): Promise<void> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Registration failed')
      }

      // After successful registration, automatically log in
      await login({
        username: registerData.username,
        password: registerData.password
      })
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  }

  const logout = (): void => {
    currentPlayer.value = null
    authToken.value = null
    tokenExpiry.value = null

    // Clear localStorage
    localStorage.removeItem('authToken')
    localStorage.removeItem('tokenExpiry')
    localStorage.removeItem('currentPlayer')
  }

  const verifyToken = async (): Promise<boolean> => {
    const token = authToken.value || localStorage.getItem('authToken')
    
    if (!token) {
      return false
    }

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })

      if (!response.ok) {
        logout()
        return false
      }

      const data = await response.json()
      
      if (data.valid) {
        currentPlayer.value = data.player
        authToken.value = token
        // Token expiry would be handled by the server response
        return true
      } else {
        logout()
        return false
      }
    } catch (error) {
      console.error('Token verification error:', error)
      logout()
      return false
    }
  }

  const initializeFromStorage = async (): Promise<void> => {
    const token = localStorage.getItem('authToken')
    const expiry = localStorage.getItem('tokenExpiry')
    const playerData = localStorage.getItem('currentPlayer')

    if (token && expiry && playerData) {
      const expiryDate = new Date(expiry)
      
      if (expiryDate > new Date()) {
        authToken.value = token
        tokenExpiry.value = expiryDate
        currentPlayer.value = JSON.parse(playerData)

        // Verify token is still valid
        const isValid = await verifyToken()
        if (!isValid) {
          logout()
        }
      } else {
        logout()
      }
    }
  }

  const getAuthHeaders = (): Record<string, string> => {
    if (!authToken.value) {
      return {}
    }

    return {
      'Authorization': `Bearer ${authToken.value}`
    }
  }

  return {
    currentPlayer,
    authToken,
    isAuthenticated,
    login,
    register,
    logout,
    verifyToken,
    initializeFromStorage,
    getAuthHeaders
  }
})