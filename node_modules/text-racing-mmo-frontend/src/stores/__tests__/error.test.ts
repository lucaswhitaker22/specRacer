import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useErrorStore } from '../error';

describe('Error Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Error Management', () => {
    it('should add and remove errors', () => {
      const errorStore = useErrorStore();
      
      const errorId = errorStore.addError('Test error', 'TEST_ERROR');
      
      expect(errorStore.errors).toHaveLength(1);
      expect(errorStore.errors[0].message).toBe('Test error');
      expect(errorStore.errors[0].code).toBe('TEST_ERROR');
      expect(errorStore.errors[0].type).toBe('error');
      expect(errorStore.hasErrors).toBe(true);
      
      errorStore.removeError(errorId);
      
      expect(errorStore.errors).toHaveLength(0);
      expect(errorStore.hasErrors).toBe(false);
    });

    it('should add different error types', () => {
      const errorStore = useErrorStore();
      
      errorStore.addError('Error message', 'ERROR_CODE', 'error');
      errorStore.addWarning('Warning message', 'WARNING_CODE');
      errorStore.addInfo('Info message', 'INFO_CODE');
      
      expect(errorStore.errors).toHaveLength(3);
      expect(errorStore.errors[0].type).toBe('error');
      expect(errorStore.errors[1].type).toBe('warning');
      expect(errorStore.errors[2].type).toBe('info');
    });

    it('should auto-remove non-persistent errors', () => {
      const errorStore = useErrorStore();
      
      errorStore.addError('Temporary error', 'TEMP_ERROR', 'error', false, true);
      
      expect(errorStore.errors).toHaveLength(1);
      
      // Fast-forward time by 5 seconds
      vi.advanceTimersByTime(5000);
      
      expect(errorStore.errors).toHaveLength(0);
    });

    it('should not auto-remove persistent errors', () => {
      const errorStore = useErrorStore();
      
      errorStore.addError('Persistent error', 'PERSISTENT_ERROR', 'error', true, true);
      
      expect(errorStore.errors).toHaveLength(1);
      
      // Fast-forward time by 5 seconds
      vi.advanceTimersByTime(5000);
      
      expect(errorStore.errors).toHaveLength(1);
    });
  });

  describe('Error Filtering and Clearing', () => {
    beforeEach(() => {
      const errorStore = useErrorStore();
      
      // Add various errors
      errorStore.addError('Error 1', 'ERROR_1', 'error', false);
      errorStore.addError('Error 2', 'ERROR_2', 'error', true);
      errorStore.addWarning('Warning 1', 'WARNING_1', false);
      errorStore.addWarning('Warning 2', 'WARNING_2', true);
      errorStore.addInfo('Info 1', 'INFO_1', false);
    });

    it('should filter persistent and temporary errors', () => {
      const errorStore = useErrorStore();
      
      expect(errorStore.persistentErrors).toHaveLength(2);
      expect(errorStore.temporaryErrors).toHaveLength(3);
    });

    it('should clear errors by code', () => {
      const errorStore = useErrorStore();
      
      errorStore.clearErrorsByCode('ERROR_1');
      
      expect(errorStore.errors).toHaveLength(4);
      expect(errorStore.errors.find(e => e.code === 'ERROR_1')).toBeUndefined();
    });

    it('should clear errors by type', () => {
      const errorStore = useErrorStore();
      
      errorStore.clearErrorsByType('warning');
      
      expect(errorStore.errors).toHaveLength(3);
      expect(errorStore.errors.filter(e => e.type === 'warning')).toHaveLength(0);
    });

    it('should clear only temporary errors', () => {
      const errorStore = useErrorStore();
      
      errorStore.clearTemporaryErrors();
      
      expect(errorStore.errors).toHaveLength(2);
      expect(errorStore.errors.every(e => e.persistent)).toBe(true);
    });

    it('should clear all errors', () => {
      const errorStore = useErrorStore();
      
      errorStore.clearErrors();
      
      expect(errorStore.errors).toHaveLength(0);
    });
  });

  describe('Error Helper Methods', () => {
    it('should handle network errors', () => {
      const errorStore = useErrorStore();
      
      const networkError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'Resource not found' }
        }
      };
      
      errorStore.handleNetworkError(networkError, 'API call');
      
      expect(errorStore.errors).toHaveLength(1);
      expect(errorStore.errors[0].message).toContain('API call failed: Resource not found');
      expect(errorStore.errors[0].code).toBe('HTTP_404');
    });

    it('should handle network errors without response', () => {
      const errorStore = useErrorStore();
      
      const networkError = {
        request: {},
        message: 'Network Error'
      };
      
      errorStore.handleNetworkError(networkError, 'API call');
      
      expect(errorStore.errors).toHaveLength(1);
      expect(errorStore.errors[0].message).toContain('No response from server');
      expect(errorStore.errors[0].code).toBe('NO_RESPONSE');
    });

    it('should handle generic request errors', () => {
      const errorStore = useErrorStore();
      
      const requestError = {
        message: 'Request setup error'
      };
      
      errorStore.handleNetworkError(requestError, 'API call');
      
      expect(errorStore.errors).toHaveLength(1);
      expect(errorStore.errors[0].message).toContain('Request setup error');
      expect(errorStore.errors[0].code).toBe('REQUEST_ERROR');
    });

    it('should handle WebSocket errors', () => {
      const errorStore = useErrorStore();
      
      const wsError = {
        message: 'Connection failed',
        code: 'WS_CONNECTION_FAILED'
      };
      
      errorStore.handleWebSocketError(wsError, 'WebSocket connection');
      
      expect(errorStore.errors).toHaveLength(1);
      expect(errorStore.errors[0].message).toContain('WebSocket connection failed: Connection failed');
      expect(errorStore.errors[0].code).toBe('WS_CONNECTION_FAILED');
    });

    it('should handle validation errors', () => {
      const errorStore = useErrorStore();
      
      errorStore.handleValidationError('email', 'Invalid email format');
      
      expect(errorStore.errors).toHaveLength(1);
      expect(errorStore.errors[0].message).toBe('email: Invalid email format');
      expect(errorStore.errors[0].code).toBe('VALIDATION_ERROR');
      expect(errorStore.errors[0].type).toBe('warning');
    });
  });

  describe('Error State Getters', () => {
    it('should get latest error', () => {
      const errorStore = useErrorStore();
      
      errorStore.addError('First error', 'ERROR_1');
      errorStore.addError('Second error', 'ERROR_2');
      
      expect(errorStore.latestError?.message).toBe('Second error');
    });

    it('should return undefined for latest error when no errors', () => {
      const errorStore = useErrorStore();
      
      expect(errorStore.latestError).toBeUndefined();
    });

    it('should correctly report has errors state', () => {
      const errorStore = useErrorStore();
      
      expect(errorStore.hasErrors).toBe(false);
      
      errorStore.addError('Test error', 'TEST_ERROR');
      
      expect(errorStore.hasErrors).toBe(true);
      
      errorStore.clearErrors();
      
      expect(errorStore.hasErrors).toBe(false);
    });
  });

  describe('Error ID Generation', () => {
    it('should generate unique error IDs', () => {
      const errorStore = useErrorStore();
      
      const id1 = errorStore.addError('Error 1', 'ERROR_1');
      const id2 = errorStore.addError('Error 2', 'ERROR_2');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^error_\d+$/);
      expect(id2).toMatch(/^error_\d+$/);
    });
  });

  describe('Error Timestamps', () => {
    it('should add timestamps to errors', () => {
      const errorStore = useErrorStore();
      
      const beforeTime = Date.now();
      errorStore.addError('Test error', 'TEST_ERROR');
      const afterTime = Date.now();
      
      expect(errorStore.errors[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(errorStore.errors[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle rapid error addition', () => {
      const errorStore = useErrorStore();
      
      // Add many errors rapidly
      for (let i = 0; i < 100; i++) {
        errorStore.addError(`Error ${i}`, `ERROR_${i}`);
      }
      
      expect(errorStore.errors).toHaveLength(100);
      expect(errorStore.hasErrors).toBe(true);
    });

    it('should handle error removal during auto-removal', () => {
      const errorStore = useErrorStore();
      
      const errorId = errorStore.addError('Auto-remove error', 'AUTO_ERROR', 'error', false, true);
      
      // Manually remove before auto-removal
      errorStore.removeError(errorId);
      
      expect(errorStore.errors).toHaveLength(0);
      
      // Fast-forward time - should not cause issues
      vi.advanceTimersByTime(5000);
      
      expect(errorStore.errors).toHaveLength(0);
    });

    it('should handle clearing errors of non-existent type', () => {
      const errorStore = useErrorStore();
      
      errorStore.addError('Test error', 'TEST_ERROR');
      
      expect(() => {
        errorStore.clearErrorsByType('nonexistent' as any);
      }).not.toThrow();
      
      expect(errorStore.errors).toHaveLength(1);
    });

    it('should handle clearing errors with non-existent code', () => {
      const errorStore = useErrorStore();
      
      errorStore.addError('Test error', 'TEST_ERROR');
      
      expect(() => {
        errorStore.clearErrorsByCode('NONEXISTENT_CODE');
      }).not.toThrow();
      
      expect(errorStore.errors).toHaveLength(1);
    });
  });
});