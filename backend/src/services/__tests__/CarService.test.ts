import { CarService } from '../CarService';
import { CarModel } from '../../../../shared/types';

describe('CarService', () => {
  let testCar: CarModel;

  beforeAll(() => {
    CarService.initialize();
  });

  beforeEach(() => {
    // Use Honda Civic Type R as test car
    testCar = {
      id: 'test-car',
      name: 'Test Car',
      manufacturer: 'Test',
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
        source: 'Test Source',
        validUntil: new Date('2025-12-31'),
        restrictions: []
      }
    };
  });

  describe('getAvailableCars', () => {
    it('should return an array of car models', () => {
      const cars = CarService.getAvailableCars();
      expect(Array.isArray(cars)).toBe(true);
      expect(cars.length).toBeGreaterThan(0);
    });

    it('should return cars with all required properties', () => {
      const cars = CarService.getAvailableCars();
      const car = cars[0];
      
      expect(car).toHaveProperty('id');
      expect(car).toHaveProperty('name');
      expect(car).toHaveProperty('manufacturer');
      expect(car).toHaveProperty('year');
      expect(car).toHaveProperty('specifications');
      expect(car).toHaveProperty('licensing');
    });

    it('should return cars with complete specifications', () => {
      const cars = CarService.getAvailableCars();
      const car = cars[0];
      const specs = car.specifications;
      
      expect(specs).toHaveProperty('horsepower');
      expect(specs).toHaveProperty('weight');
      expect(specs).toHaveProperty('dragCoefficient');
      expect(specs).toHaveProperty('frontalArea');
      expect(specs).toHaveProperty('drivetrain');
      expect(specs).toHaveProperty('tireGrip');
      expect(specs).toHaveProperty('gearRatios');
      expect(specs).toHaveProperty('aeroDownforce');
      expect(specs).toHaveProperty('fuelEconomy');
      expect(specs).toHaveProperty('zeroToSixty');
      expect(specs).toHaveProperty('topSpeed');
    });
  });

  describe('getCarById', () => {
    it('should return the correct car when found', () => {
      const cars = CarService.getAvailableCars();
      const firstCar = cars[0];
      const foundCar = CarService.getCarById(firstCar.id);
      
      expect(foundCar).toEqual(firstCar);
    });

    it('should return null when car is not found', () => {
      const foundCar = CarService.getCarById('non-existent-id');
      expect(foundCar).toBeNull();
    });
  });

  describe('calculateAcceleration', () => {
    it('should return positive acceleration at low speeds', () => {
      const acceleration = CarService.calculateAcceleration(testCar, 50); // 50 km/h
      expect(acceleration).toBeGreaterThan(0);
    });

    it('should return lower acceleration at higher speeds', () => {
      const lowSpeedAccel = CarService.calculateAcceleration(testCar, 50);
      const highSpeedAccel = CarService.calculateAcceleration(testCar, 150);
      
      expect(lowSpeedAccel).toBeGreaterThan(highSpeedAccel);
    });

    it('should return zero or near-zero acceleration at top speed', () => {
      const topSpeedAccel = CarService.calculateAcceleration(testCar, testCar.specifications.topSpeed);
      expect(topSpeedAccel).toBeLessThan(0.5); // Very low acceleration near top speed
    });

    it('should handle zero speed without errors', () => {
      const acceleration = CarService.calculateAcceleration(testCar, 0);
      expect(acceleration).toBeGreaterThan(0);
      expect(isNaN(acceleration)).toBe(false);
    });

    it('should vary by drivetrain type', () => {
      const fwdCar = { ...testCar, specifications: { ...testCar.specifications, drivetrain: 'FWD' as const } };
      const rwdCar = { ...testCar, specifications: { ...testCar.specifications, drivetrain: 'RWD' as const } };
      const awdCar = { ...testCar, specifications: { ...testCar.specifications, drivetrain: 'AWD' as const } };
      
      const fwdAccel = CarService.calculateAcceleration(fwdCar, 50);
      const rwdAccel = CarService.calculateAcceleration(rwdCar, 50);
      const awdAccel = CarService.calculateAcceleration(awdCar, 50);
      
      // FWD should be most efficient, AWD least efficient
      expect(fwdAccel).toBeGreaterThan(rwdAccel);
      expect(rwdAccel).toBeGreaterThan(awdAccel);
    });
  });

  describe('calculateBrakingDeceleration', () => {
    it('should return positive deceleration values', () => {
      const deceleration = CarService.calculateBrakingDeceleration(testCar, 100);
      expect(deceleration).toBeGreaterThan(0);
    });

    it('should increase with higher speeds due to downforce', () => {
      const lowSpeedDecel = CarService.calculateBrakingDeceleration(testCar, 50);
      const highSpeedDecel = CarService.calculateBrakingDeceleration(testCar, 150);
      
      expect(highSpeedDecel).toBeGreaterThan(lowSpeedDecel);
    });

    it('should be limited by tire grip', () => {
      const deceleration = CarService.calculateBrakingDeceleration(testCar, 100);
      const maxTheoreticalDecel = testCar.specifications.tireGrip * 1.2 * 9.81; // 1.2 is brake coefficient multiplier
      
      expect(deceleration).toBeLessThanOrEqual(maxTheoreticalDecel);
    });

    it('should handle zero speed', () => {
      const deceleration = CarService.calculateBrakingDeceleration(testCar, 0);
      expect(deceleration).toBeGreaterThan(0);
      expect(isNaN(deceleration)).toBe(false);
    });
  });

  describe('calculateTopSpeed', () => {
    it('should return a reasonable top speed', () => {
      const topSpeed = CarService.calculateTopSpeed(testCar);
      expect(topSpeed).toBeGreaterThan(200); // Should be over 200 km/h for a performance car
      expect(topSpeed).toBeLessThan(400); // Should be under 400 km/h for realism
    });

    it('should not exceed the specified top speed', () => {
      const calculatedTopSpeed = CarService.calculateTopSpeed(testCar);
      expect(calculatedTopSpeed).toBeLessThanOrEqual(testCar.specifications.topSpeed);
    });

    it('should vary with horsepower when not limited by specified top speed', () => {
      const lowPowerCar = { 
        ...testCar, 
        specifications: { ...testCar.specifications, horsepower: 150, topSpeed: 1000 } 
      };
      const highPowerCar = { 
        ...testCar, 
        specifications: { ...testCar.specifications, horsepower: 400, topSpeed: 1000 } 
      };
      
      const lowPowerTopSpeed = CarService.calculateTopSpeed(lowPowerCar);
      const highPowerTopSpeed = CarService.calculateTopSpeed(highPowerCar);
      
      expect(highPowerTopSpeed).toBeGreaterThan(lowPowerTopSpeed);
    });

    it('should vary with aerodynamics when not limited by specified top speed', () => {
      const lowDragCar = { 
        ...testCar, 
        specifications: { ...testCar.specifications, dragCoefficient: 0.20, topSpeed: 1000 } 
      };
      const highDragCar = { 
        ...testCar, 
        specifications: { ...testCar.specifications, dragCoefficient: 0.50, topSpeed: 1000 } 
      };
      
      const lowDragTopSpeed = CarService.calculateTopSpeed(lowDragCar);
      const highDragTopSpeed = CarService.calculateTopSpeed(highDragCar);
      
      expect(lowDragTopSpeed).toBeGreaterThan(highDragTopSpeed);
    });
  });

  describe('calculateFuelConsumption', () => {
    it('should return positive fuel consumption', () => {
      const consumption = CarService.calculateFuelConsumption(testCar, 100, 0.5);
      expect(consumption).toBeGreaterThan(0);
    });

    it('should increase with throttle position', () => {
      const lowThrottleConsumption = CarService.calculateFuelConsumption(testCar, 100, 0.2);
      const highThrottleConsumption = CarService.calculateFuelConsumption(testCar, 100, 0.8);
      
      expect(highThrottleConsumption).toBeGreaterThan(lowThrottleConsumption);
    });

    it('should vary with speed', () => {
      const lowSpeedConsumption = CarService.calculateFuelConsumption(testCar, 50, 0.5);
      const highSpeedConsumption = CarService.calculateFuelConsumption(testCar, 150, 0.5);
      
      // High speed should consume more fuel
      expect(highSpeedConsumption).toBeGreaterThan(lowSpeedConsumption);
    });

    it('should handle edge cases', () => {
      const zeroSpeedConsumption = CarService.calculateFuelConsumption(testCar, 0, 0.1);
      const zeroThrottleConsumption = CarService.calculateFuelConsumption(testCar, 100, 0);
      
      expect(zeroSpeedConsumption).toBeGreaterThan(0); // Idle consumption
      expect(zeroThrottleConsumption).toBeGreaterThan(0); // Minimum consumption
      expect(isNaN(zeroSpeedConsumption)).toBe(false);
      expect(isNaN(zeroThrottleConsumption)).toBe(false);
    });
  });

  describe('calculateTireWearRate', () => {
    it('should return positive wear rate', () => {
      const wearRate = CarService.calculateTireWearRate(testCar, 100, 0.5, 0.3);
      expect(wearRate).toBeGreaterThan(0);
    });

    it('should increase with speed', () => {
      const lowSpeedWear = CarService.calculateTireWearRate(testCar, 50, 0.5, 0.3);
      const highSpeedWear = CarService.calculateTireWearRate(testCar, 150, 0.5, 0.3);
      
      expect(highSpeedWear).toBeGreaterThan(lowSpeedWear);
    });

    it('should increase with lateral G forces', () => {
      const lowGWear = CarService.calculateTireWearRate(testCar, 100, 0.2, 0.3);
      const highGWear = CarService.calculateTireWearRate(testCar, 100, 1.0, 0.3);
      
      expect(highGWear).toBeGreaterThan(lowGWear);
    });

    it('should increase with braking G forces', () => {
      const lowBrakingWear = CarService.calculateTireWearRate(testCar, 100, 0.5, 0.1);
      const highBrakingWear = CarService.calculateTireWearRate(testCar, 100, 0.5, 0.8);
      
      expect(highBrakingWear).toBeGreaterThan(lowBrakingWear);
    });

    it('should vary with car weight', () => {
      const lightCar = { 
        ...testCar, 
        specifications: { ...testCar.specifications, weight: 1200 } 
      };
      const heavyCar = { 
        ...testCar, 
        specifications: { ...testCar.specifications, weight: 1800 } 
      };
      
      const lightCarWear = CarService.calculateTireWearRate(lightCar, 100, 0.5, 0.3);
      const heavyCarWear = CarService.calculateTireWearRate(heavyCar, 100, 0.5, 0.3);
      
      expect(heavyCarWear).toBeGreaterThan(lightCarWear);
    });

    it('should handle zero G forces', () => {
      const wearRate = CarService.calculateTireWearRate(testCar, 100, 0, 0);
      expect(wearRate).toBeGreaterThan(0); // Base wear rate should still apply
      expect(isNaN(wearRate)).toBe(false);
    });
  });

  describe('seeded car data integrity', () => {
    it('should have exactly 3 seeded cars', () => {
      const cars = CarService.getAvailableCars();
      expect(cars.length).toBe(3);
    });

    it('should include Honda Civic Type R', () => {
      const civic = CarService.getCarById('honda-civic-type-r-2023');
      expect(civic).not.toBeNull();
      expect(civic?.name).toBe('Civic Type R');
      expect(civic?.manufacturer).toBe('Honda');
    });

    it('should include Porsche 911 GT3', () => {
      const porsche = CarService.getCarById('porsche-911-gt3-2022');
      expect(porsche).not.toBeNull();
      expect(porsche?.name).toBe('911 GT3');
      expect(porsche?.manufacturer).toBe('Porsche');
    });

    it('should include Subaru WRX STI', () => {
      const subaru = CarService.getCarById('subaru-wrx-sti-2021');
      expect(subaru).not.toBeNull();
      expect(subaru?.name).toBe('WRX STI');
      expect(subaru?.manufacturer).toBe('Subaru');
    });

    it('should have valid licensing information for all cars', () => {
      const cars = CarService.getAvailableCars();
      
      cars.forEach(car => {
        expect(car.licensing.source).toBeTruthy();
        expect(car.licensing.validUntil).toBeInstanceOf(Date);
        expect(Array.isArray(car.licensing.restrictions)).toBe(true);
      });
    });

    it('should have realistic performance specifications', () => {
      const cars = CarService.getAvailableCars();
      
      cars.forEach(car => {
        const specs = car.specifications;
        
        // Horsepower should be reasonable for performance cars
        expect(specs.horsepower).toBeGreaterThan(250);
        expect(specs.horsepower).toBeLessThan(600);
        
        // Weight should be reasonable
        expect(specs.weight).toBeGreaterThan(1200);
        expect(specs.weight).toBeLessThan(2000);
        
        // Drag coefficient should be realistic
        expect(specs.dragCoefficient).toBeGreaterThan(0.25);
        expect(specs.dragCoefficient).toBeLessThan(0.5);
        
        // Tire grip should be reasonable
        expect(specs.tireGrip).toBeGreaterThan(0.8);
        expect(specs.tireGrip).toBeLessThan(1.5);
        
        // 0-60 times should be realistic for performance cars
        expect(specs.zeroToSixty).toBeGreaterThan(3.0);
        expect(specs.zeroToSixty).toBeLessThan(6.0);
      });
    });
  });
});