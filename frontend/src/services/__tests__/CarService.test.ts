import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CarService } from '../CarService';
import type { CarModel } from '@shared/types/index';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock car data
const mockCar: CarModel = {
  id: 'honda-civic-type-r-2023',
  name: 'Civic Type R',
  manufacturer: 'Honda',
  year: 2023,
  specifications: {
    horsepower: 315,
    weight: 1429,
    dragCoefficient: 0.37,
    frontalArea: 2.3,
    drivetrain: 'FWD',
    tireGrip: 1.1,
    gearRatios: [3.267, 2.130, 1.517, 1.147, 0.921, 0.738],
    aeroDownforce: 85,
    fuelEconomy: 8.7,
    zeroToSixty: 5.4,
    topSpeed: 272
  },
  licensing: {
    source: 'Honda Motor Co., Ltd.',
    validUntil: new Date('2025-12-31'),
    restrictions: ['Non-commercial use only']
  }
};

describe('CarService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAvailableCars', () => {
    it('should fetch and return available cars', async () => {
      const mockResponse = {
        success: true,
        data: [mockCar]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await CarService.getAvailableCars();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/cars');
      expect(result).toEqual([mockCar]);
    });

    it('should throw error when API returns error response', async () => {
      const mockResponse = {
        success: false,
        error: 'Database connection failed'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(CarService.getAvailableCars()).rejects.toThrow('Database connection failed');
    });

    it('should throw error when HTTP request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(CarService.getAvailableCars()).rejects.toThrow('HTTP error! status: 500');
    });

    it('should throw error when network request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(CarService.getAvailableCars()).rejects.toThrow('Network error');
    });

    it('should throw error when response data is missing', async () => {
      const mockResponse = {
        success: true
        // data is missing
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(CarService.getAvailableCars()).rejects.toThrow('Failed to fetch cars');
    });
  });

  describe('getCarById', () => {
    it('should fetch and return a specific car', async () => {
      const mockResponse = {
        success: true,
        data: mockCar
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await CarService.getCarById('honda-civic-type-r-2023');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/cars/honda-civic-type-r-2023');
      expect(result).toEqual(mockCar);
    });

    it('should throw "Car not found" error for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(CarService.getCarById('non-existent-car')).rejects.toThrow('Car not found');
    });

    it('should throw error when API returns error response', async () => {
      const mockResponse = {
        success: false,
        error: 'Car service unavailable'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(CarService.getCarById('honda-civic-type-r-2023')).rejects.toThrow('Car service unavailable');
    });

    it('should throw error when HTTP request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(CarService.getCarById('honda-civic-type-r-2023')).rejects.toThrow('HTTP error! status: 500');
    });

    it('should throw error when response data is missing', async () => {
      const mockResponse = {
        success: true
        // data is missing
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(CarService.getCarById('honda-civic-type-r-2023')).rejects.toThrow('Failed to fetch car');
    });
  });

  describe('isCarAvailable', () => {
    it('should return true when car exists', async () => {
      const mockResponse = {
        success: true,
        data: mockCar
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await CarService.isCarAvailable('honda-civic-type-r-2023');

      expect(result).toBe(true);
    });

    it('should return false when car does not exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await CarService.isCarAvailable('non-existent-car');

      expect(result).toBe(false);
    });

    it('should return false when service throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await CarService.isCarAvailable('honda-civic-type-r-2023');

      expect(result).toBe(false);
    });
  });
});