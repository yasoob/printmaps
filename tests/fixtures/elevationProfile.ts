import type { ElevationProfile } from '../../src/elevation/profile';

export const printProfile: ElevationProfile = {
  samples: [
    { coordinate: [16, 48], distanceMeters: 0, elevationMeters: 120 },
    { coordinate: [16.1, 48.1], distanceMeters: 10_000, elevationMeters: 260 },
    { coordinate: [16.2, 48.2], distanceMeters: 20_000, elevationMeters: 180 },
  ],
  totalDistanceMeters: 20_000,
  minimumElevationMeters: 120,
  maximumElevationMeters: 260,
  totalAscentMeters: 140,
  totalDescentMeters: 80,
  sourceLabel: 'Copernicus DEM GLO-90 via Open-Meteo',
};

export function stressPrintProfile(totalDistanceMeters = 123_456_789_012_345_000): ElevationProfile {
  return {
    ...printProfile,
    samples: [
      { coordinate: [16, 48], distanceMeters: 0, elevationMeters: -12_000 },
      { coordinate: [16.1, 48.1], distanceMeters: totalDistanceMeters * 0.001, elevationMeters: 10_000 },
      { coordinate: [16.2, 48.2], distanceMeters: totalDistanceMeters, elevationMeters: -500 },
    ],
    totalDistanceMeters, minimumElevationMeters: -12_000, maximumElevationMeters: 10_000,
    totalAscentMeters: 22_000, totalDescentMeters: 10_500,
  };
}
