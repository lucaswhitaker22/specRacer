"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarService = void 0;
class CarService {
    static initialize() {
        this.cars = this.getSeededCars();
    }
    static getAvailableCars() {
        return [...this.cars];
    }
    static getCarById(carId) {
        return this.cars.find(car => car.id === carId) || null;
    }
    static calculateAcceleration(car, currentSpeed) {
        const specs = car.specifications;
        const powerWatts = specs.horsepower * 745.7;
        const speedMs = currentSpeed / 3.6;
        const dragForce = 0.5 * 1.225 * specs.dragCoefficient * specs.frontalArea * Math.pow(speedMs, 2);
        const downforceAtSpeed = specs.aeroDownforce * Math.pow(speedMs / 27.78, 2);
        const effectiveWeight = specs.weight + downforceAtSpeed;
        const availablePower = Math.max(0, powerWatts - (dragForce * speedMs));
        const accelerationForce = availablePower / Math.max(speedMs, 1);
        const drivetrainEfficiency = this.getDrivetrainEfficiency(specs.drivetrain);
        const maxTractionForce = effectiveWeight * 9.81 * specs.tireGrip;
        const effectiveForce = Math.min(accelerationForce * drivetrainEfficiency, maxTractionForce);
        return Math.max(0, effectiveForce / effectiveWeight);
    }
    static calculateBrakingDeceleration(car, currentSpeed) {
        const specs = car.specifications;
        const speedMs = currentSpeed / 3.6;
        const downforceAtSpeed = specs.aeroDownforce * Math.pow(speedMs / 27.78, 2);
        const effectiveWeight = specs.weight + downforceAtSpeed;
        const brakingCoefficient = Math.min(specs.tireGrip * 1.2, 1.5);
        const maxBrakingForce = effectiveWeight * 9.81 * brakingCoefficient;
        return maxBrakingForce / effectiveWeight;
    }
    static calculateTopSpeed(car) {
        const specs = car.specifications;
        const powerWatts = specs.horsepower * 745.7;
        const airDensity = 1.225;
        const drivetrainEfficiency = this.getDrivetrainEfficiency(specs.drivetrain);
        const topSpeedMs = Math.pow((2 * powerWatts * drivetrainEfficiency) /
            (airDensity * specs.dragCoefficient * specs.frontalArea), 1 / 3);
        const calculatedTopSpeed = topSpeedMs * 3.6;
        return Math.min(calculatedTopSpeed, specs.topSpeed);
    }
    static calculateFuelConsumption(car, currentSpeed, throttlePosition) {
        const specs = car.specifications;
        const baseConsumptionRate = Math.max(1.0, (specs.fuelEconomy * currentSpeed) / 100);
        const throttleMultiplier = 0.3 + (throttlePosition * 0.7);
        const optimalSpeed = 80;
        const speedEfficiency = 1 + Math.abs(currentSpeed - optimalSpeed) / 200;
        return baseConsumptionRate * throttleMultiplier * speedEfficiency;
    }
    static calculateTireWearRate(car, currentSpeed, lateralG, brakingG) {
        const specs = car.specifications;
        let baseWearRate = 2.0;
        const speedFactor = 1 + (currentSpeed / 200);
        const lateralFactor = 1 + Math.pow(lateralG, 2);
        const brakingFactor = 1 + Math.pow(brakingG, 1.5);
        const weightFactor = specs.weight / 1500;
        const gripFactor = specs.tireGrip / 1.0;
        return baseWearRate * speedFactor * lateralFactor * brakingFactor * weightFactor * gripFactor;
    }
    static getDrivetrainEfficiency(drivetrain) {
        switch (drivetrain) {
            case 'FWD': return 0.92;
            case 'RWD': return 0.90;
            case 'AWD': return 0.85;
            default: return 0.90;
        }
    }
    static getSeededCars() {
        return [
            {
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
                    weight: 1418,
                    dragCoefficient: 0.315,
                    frontalArea: 2.1,
                    drivetrain: 'RWD',
                    tireGrip: 1.3,
                    gearRatios: [3.909, 2.316, 1.542, 1.179, 0.967, 0.784, 0.634],
                    aeroDownforce: 150,
                    fuelEconomy: 12.4,
                    zeroToSixty: 3.4,
                    topSpeed: 318
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
                    weight: 1568,
                    dragCoefficient: 0.35,
                    frontalArea: 2.4,
                    drivetrain: 'AWD',
                    tireGrip: 1.15,
                    gearRatios: [3.636, 2.235, 1.521, 1.137, 0.971, 0.756],
                    aeroDownforce: 45,
                    fuelEconomy: 10.7,
                    zeroToSixty: 5.1,
                    topSpeed: 255
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
exports.CarService = CarService;
CarService.cars = [];
//# sourceMappingURL=CarService.js.map