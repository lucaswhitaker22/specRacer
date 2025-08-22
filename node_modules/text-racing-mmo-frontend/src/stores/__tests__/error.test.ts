import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useErrorStore } from '../error'

describe('Error Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('should add and remove errors', () => {
    const errorStore = useErrorStore()
    
    expect(errorStore.hasErrors).toBe(false)
    
    const errorId = errorStore.addError('Test error', 'TEST_ERROR')
    
    expect(errorStore.hasErrors).toBe(true)
    expect(errorStore.errors).toHaveLength(1)
    expect(errorStore.errors[0].message).toBe('Test error')
    expect(errorStore.errors[0].code).toBe('TEST_ERROR')
    expect(errorStore.errors[0].type).toBe('error')
    
    errorStore.removeError(errorId)
    
    expect(errorStore.hasErrors).toBe(false)
    expect(errorStore.errors).toHaveLength(0)
  })

  it('should auto-remove non-persistent errors', () => {
    const errorStore = useErrorStore()
    
    errorStore.addError('Auto remove error', 'AUTO_REMOVE', 'error', false, true)
    
    expect(errorStore.errors).toHaveLength(1)
    
    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000)
    
    expect(errorStore.errors).toHaveLength(0)
  })

  it('should handle different error types', () => {
    const errorStore = useErrorStore()
    
    errorStore.addError('Error message', 'ERROR_CODE', 'error')
    errorStore.addWarning('Warning message', 'WARNING_CODE')
    errorStore.addInfo('Info message', 'INFO_CODE')
    
    expect(errorStore.errors).toHaveLength(3)
    expect(errorStore.errors[0].type).toBe('error')
    expect(errorStore.errors[1].type).toBe('warning')
    expect(errorStore.errors[2].type).toBe('info')
  })

  it('should clear errors by type', () => {
    const errorStore = useErrorStore()
    
    errorStore.addError('Error 1', 'ERROR_1', 'error')
    errorStore.addWarning('Warning 1', 'WARNING_1')
    errorStore.addInfo('Info 1', 'INFO_1')
    
    expect(errorStore.errors).toHaveLength(3)
    
    errorStore.clearErrorsByType('warning')
    
    expect(errorStore.errors).toHaveLength(2)
    expect(errorStore.errors.every(e => e.type !== 'warning')).toBe(true)
  })

  it('should handle network errors', () => {
    const errorStore = useErrorStore()
    
    const networkError = {
      response: {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Resource not found' }
      }
    }
    
    errorStore.handleNetworkError(networkError, 'API call')
    
    expect(errorStore.errors).toHaveLength(1)
    expect(errorStore.errors[0].message).toContain('API call failed: Resource not found')
    expect(errorStore.errors[0].code).toBe('HTTP_404')
  })
})