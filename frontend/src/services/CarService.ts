import type { CarModel } from '@shared/types/index';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class CarService {
  /**
   * Fetch all available car models from the API
   */
  static async getAvailableCars(): Promise<CarModel[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/cars`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<CarModel[]> = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch cars');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error fetching available cars:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific car by ID from the API
   */
  static async getCarById(carId: string): Promise<CarModel> {
    try {
      const response = await fetch(`${API_BASE_URL}/cars/${carId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Car not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<CarModel> = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch car');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Error fetching car ${carId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a car is available for selection
   * This is a placeholder for future availability checking logic
   */
  static async isCarAvailable(carId: string): Promise<boolean> {
    try {
      // For now, just check if the car exists
      await this.getCarById(carId);
      return true;
    } catch (error) {
      return false;
    }
  }
}