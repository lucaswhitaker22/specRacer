import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AppError {
  id: string
  message: string
  code: string
  timestamp: number
  type: 'error' | 'warning' | 'info'
  persistent: boolean
}

export const useErrorStore = defineStore('error', () => {
  // State
  const errors = ref<AppError[]>([])
  const nextId = ref(1)

  // Getters
  const hasErrors = computed(() => errors.value.length > 0)
  const latestError = computed(() => errors.value[errors.value.length - 1])
  const persistentErrors = computed(() => errors.value.filter(e => e.persistent))
  const temporaryErrors = computed(() => errors.value.filter(e => !e.persistent))

  // Actions
  function addError(
    message: string, 
    code: string, 
    type: AppError['type'] = 'error',
    persistent = false,
    autoRemove = true
  ): string {
    const error: AppError = {
      id: `error_${nextId.value++}`,
      message,
      code,
      timestamp: Date.now(),
      type,
      persistent
    }

    errors.value.push(error)

    // Auto-remove non-persistent errors after 5 seconds
    if (!persistent && autoRemove) {
      setTimeout(() => {
        removeError(error.id)
      }, 5000)
    }

    return error.id
  }

  function addWarning(message: string, code: string, persistent = false): string {
    return addError(message, code, 'warning', persistent)
  }

  function addInfo(message: string, code: string, persistent = false): string {
    return addError(message, code, 'info', persistent)
  }

  function addSuccess(message: string, code: string, persistent = false): string {
    return addError(message, code, 'info', persistent)
  }

  function removeError(id: string) {
    const index = errors.value.findIndex(e => e.id === id)
    if (index !== -1) {
      errors.value.splice(index, 1)
    }
  }

  function clearErrors() {
    errors.value = []
  }

  function clearErrorsByCode(code: string) {
    errors.value = errors.value.filter(e => e.code !== code)
  }

  function clearErrorsByType(type: AppError['type']) {
    errors.value = errors.value.filter(e => e.type !== type)
  }

  function clearTemporaryErrors() {
    errors.value = errors.value.filter(e => e.persistent)
  }

  // Network error helpers
  function handleNetworkError(error: any, context = 'Network operation') {
    let message = `${context} failed`
    let code = 'NETWORK_ERROR'

    if (error.response) {
      // Server responded with error status
      message = `${context} failed: ${error.response.data?.message || error.response.statusText}`
      code = `HTTP_${error.response.status}`
    } else if (error.request) {
      // Request made but no response
      message = `${context} failed: No response from server`
      code = 'NO_RESPONSE'
    } else {
      // Something else happened
      message = `${context} failed: ${error.message}`
      code = 'REQUEST_ERROR'
    }

    return addError(message, code)
  }

  // WebSocket error helpers
  function handleWebSocketError(error: any, context = 'WebSocket operation') {
    const message = `${context} failed: ${error.message || 'Unknown error'}`
    const code = error.code || 'WEBSOCKET_ERROR'
    return addError(message, code)
  }

  // Validation error helpers
  function handleValidationError(field: string, message: string) {
    return addError(`${field}: ${message}`, 'VALIDATION_ERROR', 'warning')
  }

  return {
    // State
    errors,
    
    // Getters
    hasErrors,
    latestError,
    persistentErrors,
    temporaryErrors,
    
    // Actions
    addError,
    addWarning,
    addInfo,
    addSuccess,
    removeError,
    clearErrors,
    clearErrorsByCode,
    clearErrorsByType,
    clearTemporaryErrors,
    
    // Helper methods
    handleNetworkError,
    handleWebSocketError,
    handleValidationError
  }
})