import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CarSelection from '../CarSelection.vue';
import { CarService } from '../../services/CarService';
import type { CarModel } from '@shared/types/index';

// Mock the CarService
vi.mock('../../services/CarService');
const mockCarService = vi.mocked(CarService);

// Mock car data
const mockCars: CarModel[] = [
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
      restrictions: ['Non-commercial use only']
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
      restrictions: ['Educational and gaming use permitted']
    }
  }
];

describe('CarSelection Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    mockCarService.getAvailableCars.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading available cars...');
  });

  it('displays cars after successful loading', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    mockCarService.isCarAvailable.mockResolvedValue(true);
    
    const wrapper = mount(CarSelection);
    
    // Wait for the component to load
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(wrapper.find('.car-grid').exists()).toBe(true);
    expect(wrapper.findAll('.car-card')).toHaveLength(2);
    expect(wrapper.text()).toContain('Civic Type R');
    expect(wrapper.text()).toContain('911 GT3');
  });

  it('displays error state when loading fails', async () => {
    const errorMessage = 'Network error';
    mockCarService.getAvailableCars.mockRejectedValue(new Error(errorMessage));
    
    const wrapper = mount(CarSelection);
    
    // Wait for the error to be handled
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Failed to Load Cars');
    expect(wrapper.text()).toContain(errorMessage);
  });

  it('allows retrying after error', async () => {
    mockCarService.getAvailableCars
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockCars);
    
    const wrapper = mount(CarSelection);
    
    // Wait for initial error
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(wrapper.find('.error-state').exists()).toBe(true);
    
    // Click retry button
    await wrapper.find('.retry-button').trigger('click');
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(wrapper.find('.car-grid').exists()).toBe(true);
    expect(wrapper.findAll('.car-card')).toHaveLength(2);
  });

  it('displays car specifications correctly', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const firstCard = wrapper.find('.car-card');
    expect(firstCard.text()).toContain('315 HP');
    expect(firstCard.text()).toContain('1429 kg');
    expect(firstCard.text()).toContain('FWD');
    expect(firstCard.text()).toContain('5.4s');
    expect(firstCard.text()).toContain('272 km/h');
  });

  it('emits carSelected event when car is selected', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    mockCarService.isCarAvailable.mockResolvedValue(true);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const selectButton = wrapper.find('.select-button');
    await selectButton.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.emitted('carSelected')).toBeTruthy();
    expect(wrapper.emitted('carSelected')?.[0]).toEqual([mockCars[0]]);
  });

  it('shows selected state for selected car', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    mockCarService.isCarAvailable.mockResolvedValue(true);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Select the first car
    const selectButton = wrapper.find('.select-button');
    await selectButton.trigger('click');
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const firstCard = wrapper.find('.car-card');
    expect(firstCard.classes()).toContain('selected');
    expect(firstCard.find('.selected-button').exists()).toBe(true);
    expect(firstCard.find('.selected-button').text()).toContain('Selected');
  });

  it('toggles detailed specifications', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const firstCard = wrapper.find('.car-card');
    const detailsButton = firstCard.find('.details-button');
    
    // Initially details should be hidden
    expect(firstCard.find('.car-details').exists()).toBe(false);
    expect(detailsButton.text()).toContain('Show Details');
    
    // Click to show details
    await detailsButton.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(firstCard.find('.car-details').exists()).toBe(true);
    expect(detailsButton.text()).toContain('Hide Details');
    
    // Verify detailed specs are shown
    const details = firstCard.find('.car-details');
    expect(details.text()).toContain('Drag Coefficient');
    expect(details.text()).toContain('0.37');
    expect(details.text()).toContain('Frontal Area');
    expect(details.text()).toContain('2.3 m²');
  });

  it('displays licensing information in details', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const firstCard = wrapper.find('.car-card');
    const detailsButton = firstCard.find('.details-button');
    
    await detailsButton.trigger('click');
    await wrapper.vm.$nextTick();
    
    const licensingInfo = firstCard.find('.licensing-info');
    expect(licensingInfo.text()).toContain('Honda Motor Co., Ltd.');
    expect(licensingInfo.text()).toContain('Non-commercial use only');
  });

  it('handles unavailable cars correctly', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    mockCarService.isCarAvailable.mockResolvedValue(false);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const firstCard = wrapper.find('.car-card');
    expect(firstCard.classes()).toContain('unavailable');
    expect(firstCard.find('.unavailable-button').exists()).toBe(true);
    expect(firstCard.find('.unavailable-button').text()).toContain('Unavailable');
  });

  it('displays empty state when no cars are available', async () => {
    mockCarService.getAvailableCars.mockResolvedValue([]);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('No Cars Available');
  });

  it('validates car selection before emitting event', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    mockCarService.isCarAvailable.mockResolvedValue(false);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // When car is unavailable, there should be no select button
    const selectButton = wrapper.find('.select-button');
    expect(selectButton.exists()).toBe(false);
    
    // There should be an unavailable button instead
    const unavailableButton = wrapper.find('.unavailable-button');
    expect(unavailableButton.exists()).toBe(true);
    
    // Should not emit carSelected event for unavailable car
    expect(wrapper.emitted('carSelected')).toBeFalsy();
  });

  it('formats dates correctly', async () => {
    mockCarService.getAvailableCars.mockResolvedValue(mockCars);
    
    const wrapper = mount(CarSelection);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const firstCard = wrapper.find('.car-card');
    const detailsButton = firstCard.find('.details-button');
    
    await detailsButton.trigger('click');
    await wrapper.vm.$nextTick();
    
    const licensingInfo = firstCard.find('.licensing-info');
    // Should contain a formatted date (exact format may vary by locale)
    expect(licensingInfo.text()).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
  });
});