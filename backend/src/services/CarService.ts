import { CarModel, CarSpecifications } from '../../../shared/types';

// Car specification and performance service
export class CarService {
  private static cars: CarModel[] = [];

  /**
   * Initialize the car service with seeded car data
   */
  static initialize(): void {
    this.cars = this.getSeededCars();
  }

  /**
   * Get all available car models
   */
  static getAvailableCars(): CarModel[] {
    return [...this.cars];
  }

  /**
   * Get a specific car by ID
   */
  static getCarById(carId: string): CarModel | null {
    return this.cars.find(car => car.id === carId) || null;
  }

  /**
   * Calculate acceleration based on car specifications
   * Returns acceleration in m/s²
   */
  static calculateAcceleration(car: CarModel, currentSpeed: number): number {
    const specs = car.specifications;
    
    // Convert horsepower to watts (1 HP = 745.7 watts)
    const powerWatts = specs.horsepower * 745.7;
    
    // Convert speed from km/h to m/s
    const speedMs = currentSpeed / 3.6;
    
    // Calculate drag force: F_drag = 0.5 * ρ * Cd * A * v²
    // Using air density ρ = 1.225 kg/m³ at sea level
    const dragForce = 0.5 * 1.225 * specs.dragCoefficient * specs.frontalArea * Math.pow(speedMs, 2);
    
    // Calculate downforce (increases effective weight)
    const downforceAtSpeed = specs.aeroDownforce * Math.pow(speedMs / 27.78, 2); // 27.78 m/s = 100 km/h
    const effectiveWeight = specs.weight + downforceAtSpeed;
    
    // Available power at current speed (accounting for drag)
    const availablePower = Math.max(0, powerWatts - (dragForce * speedMs));
    
    // Calculate force available for acceleration
    const accelerationForce = availablePower / Math.max(speedMs, 1); // Avoid division by zero
    
    // Apply drivetrain efficiency and tire grip limitations
    const drivetrainEfficiency = this.getDrivetrainEfficiency(specs.drivetrain);
    const maxTractionForce = effectiveWeight * 9.81 * specs.tireGrip; // F = μ * N
    
    const effectiveForce = Math.min(accelerationForce * drivetrainEfficiency, maxTractionForce);
    
    // Calculate acceleration: a = F / m
    return Math.max(0, effectiveForce / effectiveWeight);
  }

  /**
   * Calculate braking deceleration based on car specifications
   * Returns deceleration in m/s² (positive value)
   */
  static calculateBrakingDeceleration(car: CarModel, currentSpeed: number): number {
    const specs = car.specifications;
    
    // Convert speed from km/h to m/s
    const speedMs = currentSpeed / 3.6;
    
    // Calculate downforce (increases braking grip)
    const downforceAtSpeed = specs.aeroDownforce * Math.pow(speedMs / 27.78, 2);
    const effectiveWeight = specs.weight + downforceAtSpeed;
    
    // Maximum braking force limited by tire grip
    // Assuming brake coefficient is slightly higher than tire grip for acceleration
    const brakingCoefficient = Math.min(specs.tireGrip * 1.2, 1.5); // Cap at 1.5g
    const maxBrakingForce = effectiveWeight * 9.81 * brakingCoefficient;
    
    // Calculate deceleration
    return maxBrakingForce / effectiveWeight;
  }

  /**
   * Calculate top speed based on car specifications
   * Returns top speed in km/h
   */
  static calculateTopSpeed(car: CarModel): number {
    const specs = car.specifications;
    
    // Convert horsepower to watts
    const powerWatts = specs.horsepower * 745.7;
    
    // At top speed, drag force equals driving force
    // F_drag = 0.5 * ρ * Cd * A * v²
    // Power = Force * velocity, so P = F_drag * v = 0.5 * ρ * Cd * A * v³
    // Solving for v: v = (2 * P / (ρ * Cd * A * η))^(1/3)
    const airDensity = 1.225; // kg/m³
    const drivetrainEfficiency = this.getDrivetrainEfficiency(specs.drivetrain);
    
    const topSpeedMs = Math.pow(
      (2 * powerWatts * drivetrainEfficiency) / 
      (airDensity * specs.dragCoefficient * specs.frontalArea),
      1/3
    );
    
    // Convert to km/h
    const calculatedTopSpeed = topSpeedMs * 3.6;
    
    // Use the lower of calculated or specified top speed
    return Math.min(calculatedTopSpeed, specs.topSpeed);
  }

  /**
   * Calculate fuel consumption rate based on current conditions
   * Returns fuel consumption in L/h
   */
  static calculateFuelConsumption(car: CarModel, currentSpeed: number, throttlePosition: number): number {
    const specs = car.specifications;
    
    // Base consumption from specifications (L/100km to L/h conversion)
    // Ensure minimum consumption even at zero speed (idle consumption)
    const baseConsumptionRate = Math.max(1.0, (specs.fuelEconomy * currentSpeed) / 100);
    
    // Adjust for throttle position (0-1 scale)
    const throttleMultiplier = 0.3 + (throttlePosition * 0.7); // Idle + throttle-dependent consumption
    
    // Adjust for speed efficiency (cars are most efficient at moderate speeds)
    const optimalSpeed = 80; // km/h
    const speedEfficiency = 1 + Math.abs(currentSpeed - optimalSpeed) / 200;
    
    return baseConsumptionRate * throttleMultiplier * speedEfficiency;
  }

  /**
   * Calculate tire wear rate based on driving conditions
   * Returns wear rate as percentage per hour
   */
  static calculateTireWearRate(car: CarModel, currentSpeed: number, lateralG: number, brakingG: number): number {
    const specs = car.specifications;
    
    // Base wear rate (percentage per hour)
    let baseWearRate = 2.0; // 2% per hour under normal conditions
    
    // Speed factor (higher speeds increase wear)
    const speedFactor = 1 + (currentSpeed / 200); // Increases linearly with speed
    
    // Lateral G factor (cornering increases wear)
    const lateralFactor = 1 + Math.pow(lateralG, 2);
    
    // Braking factor (hard braking increases wear)
    const brakingFactor = 1 + Math.pow(brakingG, 1.5);
    
    // Car weight factor (heavier cars wear tires more)
    const weightFactor = specs.weight / 1500; // Normalized to 1500kg baseline
    
    // Tire grip factor (higher grip tires wear faster)
    const gripFactor = specs.tireGrip / 1.0; // Normalized to 1.0 baseline
    
    return baseWearRate * speedFactor * lateralFactor * brakingFactor * weightFactor * gripFactor;
  }

  /**
   * Get drivetrain efficiency multiplier
   */
  private static getDrivetrainEfficiency(drivetrain: 'FWD' | 'RWD' | 'AWD'): number {
    switch (drivetrain) {
      case 'FWD': return 0.92; // Front-wheel drive
      case 'RWD': return 0.90; // Rear-wheel drive (slightly less efficient due to driveshaft)
      case 'AWD': return 0.85; // All-wheel drive (power split reduces efficiency)
      default: return 0.90;
    }
  }

  /**
   * Get seeded car data with 2-3 licensed car models
   */
  private static getSeededCars(): CarModel[] {
    return [
      {
        id: 'honda-civic-type-r-2023',
        name: 'Civic Type R',
        manufacturer: 'Honda',
        year: 2023,
        specifications: {
          horsepower: 315,
          weight: 1429, // kg
          dragCoefficient: 0.37,
          frontalArea: 2.3, // m²
          drivetrain: 'FWD',
          tireGrip: 1.1,
          gearRatios: [3.267, 2.130, 1.517, 1.147, 0.921, 0.738],
          aeroDownforce: 85, // kg at 100mph
          fuelEconomy: 8.7, // L/100km combined
          zeroToSixty: 5.4, // seconds
          topSpeed: 272 // km/h
        },
        licensing: {
          source: 'Honda Motor Co., Ltd.',
          validUntil: new Date('2025-12-31'),
          restrictions: ['Non-commercial use only', 'Accurate specification representation required']
        }
      },
      {
        id: 'porsche-911-gt3-2022',
        name: '911 GT3',
        manufacturer: 'Porsche',
        year: 2022,
        specifications: {
          horsepower: 502,
          weight: 1418, // kg
          dragCoefficient: 0.315,
          frontalArea: 2.1, // m²
          drivetrain: 'RWD',
          tireGrip: 1.3,
          gearRatios: [3.909, 2.316, 1.542, 1.179, 0.967, 0.784, 0.634],
          aeroDownforce: 150, // kg at 100mph
          fuelEconomy: 12.4, // L/100km combined
          zeroToSixty: 3.4, // seconds
          topSpeed: 318 // km/h
        },
        licensing: {
          source: 'Dr. Ing. h.c. F. Porsche AG',
          validUntil: new Date('2025-12-31'),
          restrictions: ['Educational and gaming use permitted', 'Trademark acknowledgment required']
        }
      },
      {
        id: 'subaru-wrx-sti-2021',
        name: 'WRX STI',
        manufacturer: 'Subaru',
        year: 2021,
        specifications: {
          horsepower: 310,
          weight: 1568, // kg
          dragCoefficient: 0.35,
          frontalArea: 2.4, // m²
          drivetrain: 'AWD',
          tireGrip: 1.15,
          gearRatios: [3.636, 2.235, 1.521, 1.137, 0.971, 0.756],
          aeroDownforce: 45, // kg at 100mph
          fuelEconomy: 10.7, // L/100km combined
          zeroToSixty: 5.1, // seconds
          topSpeed: 255 // km/h
        },
        licensing: {
          source: 'Subaru Corporation',
          validUntil: new Date('2025-12-31'),
          restrictions: ['Gaming and simulation use approved', 'Performance data based on manufacturer specifications']
        }
      }
    ];
  }
}