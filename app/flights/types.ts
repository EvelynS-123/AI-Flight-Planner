export type FlightSearchRequest = {
  origin: string;
  destination: string;
  departureDate: string;
  adults?: number;
  currency?: string;
  forceRefresh?: boolean;
};
export type LiveFlightSegment = {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  departureLocal: string;
  arrivalLocal: string;
  durationMinutes: number;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  airplane?: string;
  travelClass?: string;
  logoUrl: string;
};

export type LiveFlightLayover = {
  airport: string;
  name: string;
  durationMinutes: number;
  overnight: boolean;
};

export type LiveFlightOffer = {
  id: string;
  price: number;
  currency: string;
  totalDurationMinutes: number;
  type: string;
  segments: LiveFlightSegment[];
  layovers: LiveFlightLayover[];
  source: "Google Flights via SerpApi";
  sourceUrl: string;
  departureToken?: string;
  bookingToken?: string;
};

export type LiveFlightSearchResult = {
  provider: "serpapi-google-flights";
  searchedAt: string;
  cached: boolean;
  request: Required<Pick<
    FlightSearchRequest,
    "origin" | "destination" | "departureDate" | "adults" | "currency"
  >>;
  offers: LiveFlightOffer[];
};
