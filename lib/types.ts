export interface LocationResult {
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface ParsedPlace {
  type: 'place';
  query?: string;
  lat?: number;
  lng?: number;
}

export interface ParsedDirections {
  type: 'directions';
  stops: Array<{ query?: string; lat?: number; lng?: number }>;
  travelMode: 'driving' | 'walking' | 'transit';
}

export type ParsedGoogleUrl = ParsedPlace | ParsedDirections | { type: 'unknown' };

export interface DirectionLeg {
  from: LocationResult;
  to: LocationResult;
  appleUrl: string;
}

export interface PlaceConversionResult {
  type: 'place';
  location: LocationResult;
  appleUrl: string;
}

export interface DirectionsConversionResult {
  type: 'directions';
  stops: LocationResult[];
  appleUrl: string;
  legs: DirectionLeg[];
  isMultiStop: boolean;
}

export type ConversionResult = PlaceConversionResult | DirectionsConversionResult;
