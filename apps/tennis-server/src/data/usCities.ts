/**
 * US Cities → County lookup.
 * Curated dataset of US cities with their county and state.
 * Includes major metros, California cities, and notable smaller cities.
 */

export interface CityRecord {
  city: string;
  state: string;
  stateCode: string;
  county: string;
}

export const US_CITIES: CityRecord[] = [
  // ── California ─────────────────────────────────────────────────────────────
  // Marin County
  { city: "Larkspur", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "San Rafael", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Mill Valley", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Sausalito", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Novato", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Tiburon", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Corte Madera", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Fairfax", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "San Anselmo", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Ross", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Belvedere", state: "California", stateCode: "CA", county: "Marin County" },
  { city: "Stinson Beach", state: "California", stateCode: "CA", county: "Marin County" },
  // San Francisco
  { city: "San Francisco", state: "California", stateCode: "CA", county: "San Francisco County" },
  // San Mateo County
  { city: "San Mateo", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Redwood City", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Daly City", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "South San Francisco", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Burlingame", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "San Bruno", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Menlo Park", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Foster City", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Pacifica", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Half Moon Bay", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Hillsborough", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Atherton", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Woodside", state: "California", stateCode: "CA", county: "San Mateo County" },
  { city: "Portola Valley", state: "California", stateCode: "CA", county: "San Mateo County" },
  // Santa Clara County
  { city: "San Jose", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Santa Clara", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Sunnyvale", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Mountain View", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Palo Alto", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Cupertino", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Milpitas", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Campbell", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Los Gatos", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Saratoga", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Los Altos", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Morgan Hill", state: "California", stateCode: "CA", county: "Santa Clara County" },
  { city: "Gilroy", state: "California", stateCode: "CA", county: "Santa Clara County" },
  // Alameda County
  { city: "Oakland", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Berkeley", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Fremont", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Hayward", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Pleasanton", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Livermore", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Alameda", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Union City", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Newark", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Dublin", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Emeryville", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Albany", state: "California", stateCode: "CA", county: "Alameda County" },
  { city: "Piedmont", state: "California", stateCode: "CA", county: "Alameda County" },
  // Contra Costa County
  { city: "Walnut Creek", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Concord", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Richmond", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Antioch", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "San Ramon", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Danville", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Lafayette", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Orinda", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Martinez", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Pleasant Hill", state: "California", stateCode: "CA", county: "Contra Costa County" },
  { city: "Brentwood", state: "California", stateCode: "CA", county: "Contra Costa County" },
  // Sonoma County
  { city: "Santa Rosa", state: "California", stateCode: "CA", county: "Sonoma County" },
  { city: "Petaluma", state: "California", stateCode: "CA", county: "Sonoma County" },
  { city: "Rohnert Park", state: "California", stateCode: "CA", county: "Sonoma County" },
  { city: "Healdsburg", state: "California", stateCode: "CA", county: "Sonoma County" },
  { city: "Sonoma", state: "California", stateCode: "CA", county: "Sonoma County" },
  { city: "Windsor", state: "California", stateCode: "CA", county: "Sonoma County" },
  // Napa County
  { city: "Napa", state: "California", stateCode: "CA", county: "Napa County" },
  { city: "St. Helena", state: "California", stateCode: "CA", county: "Napa County" },
  { city: "Calistoga", state: "California", stateCode: "CA", county: "Napa County" },
  { city: "Yountville", state: "California", stateCode: "CA", county: "Napa County" },
  // Solano County
  { city: "Vallejo", state: "California", stateCode: "CA", county: "Solano County" },
  { city: "Fairfield", state: "California", stateCode: "CA", county: "Solano County" },
  { city: "Vacaville", state: "California", stateCode: "CA", county: "Solano County" },
  { city: "Benicia", state: "California", stateCode: "CA", county: "Solano County" },
  // Santa Cruz County
  { city: "Santa Cruz", state: "California", stateCode: "CA", county: "Santa Cruz County" },
  { city: "Scotts Valley", state: "California", stateCode: "CA", county: "Santa Cruz County" },
  { city: "Capitola", state: "California", stateCode: "CA", county: "Santa Cruz County" },
  { city: "Watsonville", state: "California", stateCode: "CA", county: "Santa Cruz County" },
  // Monterey County
  { city: "Monterey", state: "California", stateCode: "CA", county: "Monterey County" },
  { city: "Salinas", state: "California", stateCode: "CA", county: "Monterey County" },
  { city: "Carmel-by-the-Sea", state: "California", stateCode: "CA", county: "Monterey County" },
  { city: "Pacific Grove", state: "California", stateCode: "CA", county: "Monterey County" },
  // Los Angeles County
  { city: "Los Angeles", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Long Beach", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Santa Monica", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Pasadena", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Burbank", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Glendale", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Torrance", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Beverly Hills", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "West Hollywood", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Manhattan Beach", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Hermosa Beach", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Redondo Beach", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Culver City", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "El Segundo", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Malibu", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Calabasas", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Arcadia", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Whittier", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Pomona", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Claremont", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "West Covina", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Cerritos", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Downey", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Inglewood", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Compton", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Lancaster", state: "California", stateCode: "CA", county: "Los Angeles County" },
  { city: "Palmdale", state: "California", stateCode: "CA", county: "Los Angeles County" },
  // Orange County
  { city: "Anaheim", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Irvine", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Santa Ana", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Huntington Beach", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Newport Beach", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Costa Mesa", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Fullerton", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Laguna Beach", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Mission Viejo", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Lake Forest", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "Dana Point", state: "California", stateCode: "CA", county: "Orange County" },
  { city: "San Clemente", state: "California", stateCode: "CA", county: "Orange County" },
  // San Diego County
  { city: "San Diego", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Carlsbad", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Encinitas", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Oceanside", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "La Jolla", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Del Mar", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Coronado", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Chula Vista", state: "California", stateCode: "CA", county: "San Diego County" },
  { city: "Escondido", state: "California", stateCode: "CA", county: "San Diego County" },
  // Riverside County
  { city: "Riverside", state: "California", stateCode: "CA", county: "Riverside County" },
  { city: "Palm Springs", state: "California", stateCode: "CA", county: "Riverside County" },
  { city: "Temecula", state: "California", stateCode: "CA", county: "Riverside County" },
  { city: "Murrieta", state: "California", stateCode: "CA", county: "Riverside County" },
  { city: "Corona", state: "California", stateCode: "CA", county: "Riverside County" },
  { city: "Indio", state: "California", stateCode: "CA", county: "Riverside County" },
  // San Bernardino County
  { city: "San Bernardino", state: "California", stateCode: "CA", county: "San Bernardino County" },
  { city: "Ontario", state: "California", stateCode: "CA", county: "San Bernardino County" },
  { city: "Rancho Cucamonga", state: "California", stateCode: "CA", county: "San Bernardino County" },
  { city: "Fontana", state: "California", stateCode: "CA", county: "San Bernardino County" },
  { city: "Upland", state: "California", stateCode: "CA", county: "San Bernardino County" },
  // Ventura County
  { city: "Ventura", state: "California", stateCode: "CA", county: "Ventura County" },
  { city: "Thousand Oaks", state: "California", stateCode: "CA", county: "Ventura County" },
  { city: "Oxnard", state: "California", stateCode: "CA", county: "Ventura County" },
  { city: "Simi Valley", state: "California", stateCode: "CA", county: "Ventura County" },
  { city: "Camarillo", state: "California", stateCode: "CA", county: "Ventura County" },
  { city: "Moorpark", state: "California", stateCode: "CA", county: "Ventura County" },
  { city: "Ojai", state: "California", stateCode: "CA", county: "Ventura County" },
  // Santa Barbara County
  { city: "Santa Barbara", state: "California", stateCode: "CA", county: "Santa Barbara County" },
  { city: "Goleta", state: "California", stateCode: "CA", county: "Santa Barbara County" },
  { city: "Santa Maria", state: "California", stateCode: "CA", county: "Santa Barbara County" },
  { city: "Lompoc", state: "California", stateCode: "CA", county: "Santa Barbara County" },
  // San Luis Obispo County
  { city: "San Luis Obispo", state: "California", stateCode: "CA", county: "San Luis Obispo County" },
  { city: "Paso Robles", state: "California", stateCode: "CA", county: "San Luis Obispo County" },
  { city: "Pismo Beach", state: "California", stateCode: "CA", county: "San Luis Obispo County" },
  // Sacramento County
  { city: "Sacramento", state: "California", stateCode: "CA", county: "Sacramento County" },
  { city: "Elk Grove", state: "California", stateCode: "CA", county: "Sacramento County" },
  { city: "Folsom", state: "California", stateCode: "CA", county: "Sacramento County" },
  { city: "Rancho Cordova", state: "California", stateCode: "CA", county: "Sacramento County" },
  { city: "Citrus Heights", state: "California", stateCode: "CA", county: "Sacramento County" },
  // Placer County
  { city: "Roseville", state: "California", stateCode: "CA", county: "Placer County" },
  { city: "Rocklin", state: "California", stateCode: "CA", county: "Placer County" },
  { city: "Lincoln", state: "California", stateCode: "CA", county: "Placer County" },
  { city: "Auburn", state: "California", stateCode: "CA", county: "Placer County" },
  // El Dorado County
  { city: "El Dorado Hills", state: "California", stateCode: "CA", county: "El Dorado County" },
  { city: "Placerville", state: "California", stateCode: "CA", county: "El Dorado County" },
  { city: "South Lake Tahoe", state: "California", stateCode: "CA", county: "El Dorado County" },
  // Fresno County
  { city: "Fresno", state: "California", stateCode: "CA", county: "Fresno County" },
  { city: "Clovis", state: "California", stateCode: "CA", county: "Fresno County" },
  // Other CA
  { city: "Bakersfield", state: "California", stateCode: "CA", county: "Kern County" },
  { city: "Stockton", state: "California", stateCode: "CA", county: "San Joaquin County" },
  { city: "Modesto", state: "California", stateCode: "CA", county: "Stanislaus County" },
  { city: "Visalia", state: "California", stateCode: "CA", county: "Tulare County" },
  { city: "Redding", state: "California", stateCode: "CA", county: "Shasta County" },
  { city: "Chico", state: "California", stateCode: "CA", county: "Butte County" },
  { city: "Davis", state: "California", stateCode: "CA", county: "Yolo County" },
  { city: "Woodland", state: "California", stateCode: "CA", county: "Yolo County" },
  { city: "Eureka", state: "California", stateCode: "CA", county: "Humboldt County" },
  { city: "Santa Rosa", state: "California", stateCode: "CA", county: "Sonoma County" },
  { city: "Truckee", state: "California", stateCode: "CA", county: "Nevada County" },
  { city: "Grass Valley", state: "California", stateCode: "CA", county: "Nevada County" },

  // ── New York ───────────────────────────────────────────────────────────────
  { city: "New York", state: "New York", stateCode: "NY", county: "New York County" },
  { city: "Brooklyn", state: "New York", stateCode: "NY", county: "Kings County" },
  { city: "Queens", state: "New York", stateCode: "NY", county: "Queens County" },
  { city: "Bronx", state: "New York", stateCode: "NY", county: "Bronx County" },
  { city: "Staten Island", state: "New York", stateCode: "NY", county: "Richmond County" },
  { city: "Buffalo", state: "New York", stateCode: "NY", county: "Erie County" },
  { city: "Rochester", state: "New York", stateCode: "NY", county: "Monroe County" },
  { city: "Syracuse", state: "New York", stateCode: "NY", county: "Onondaga County" },
  { city: "Albany", state: "New York", stateCode: "NY", county: "Albany County" },
  { city: "Yonkers", state: "New York", stateCode: "NY", county: "Westchester County" },
  { city: "White Plains", state: "New York", stateCode: "NY", county: "Westchester County" },
  { city: "Scarsdale", state: "New York", stateCode: "NY", county: "Westchester County" },
  { city: "Rye", state: "New York", stateCode: "NY", county: "Westchester County" },
  { city: "New Rochelle", state: "New York", stateCode: "NY", county: "Westchester County" },
  { city: "Mamaroneck", state: "New York", stateCode: "NY", county: "Westchester County" },
  { city: "Garden City", state: "New York", stateCode: "NY", county: "Nassau County" },
  { city: "Great Neck", state: "New York", stateCode: "NY", county: "Nassau County" },
  { city: "Manhasset", state: "New York", stateCode: "NY", county: "Nassau County" },
  { city: "Hempstead", state: "New York", stateCode: "NY", county: "Nassau County" },
  { city: "Southampton", state: "New York", stateCode: "NY", county: "Suffolk County" },
  { city: "East Hampton", state: "New York", stateCode: "NY", county: "Suffolk County" },
  { city: "Montauk", state: "New York", stateCode: "NY", county: "Suffolk County" },
  { city: "Huntington", state: "New York", stateCode: "NY", county: "Suffolk County" },
  { city: "Ithaca", state: "New York", stateCode: "NY", county: "Tompkins County" },
  { city: "Saratoga Springs", state: "New York", stateCode: "NY", county: "Saratoga County" },

  // ── Texas ──────────────────────────────────────────────────────────────────
  { city: "Houston", state: "Texas", stateCode: "TX", county: "Harris County" },
  { city: "San Antonio", state: "Texas", stateCode: "TX", county: "Bexar County" },
  { city: "Dallas", state: "Texas", stateCode: "TX", county: "Dallas County" },
  { city: "Austin", state: "Texas", stateCode: "TX", county: "Travis County" },
  { city: "Fort Worth", state: "Texas", stateCode: "TX", county: "Tarrant County" },
  { city: "El Paso", state: "Texas", stateCode: "TX", county: "El Paso County" },
  { city: "Arlington", state: "Texas", stateCode: "TX", county: "Tarrant County" },
  { city: "Plano", state: "Texas", stateCode: "TX", county: "Collin County" },
  { city: "Frisco", state: "Texas", stateCode: "TX", county: "Collin County" },
  { city: "McKinney", state: "Texas", stateCode: "TX", county: "Collin County" },
  { city: "Round Rock", state: "Texas", stateCode: "TX", county: "Williamson County" },
  { city: "The Woodlands", state: "Texas", stateCode: "TX", county: "Montgomery County" },
  { city: "Sugar Land", state: "Texas", stateCode: "TX", county: "Fort Bend County" },
  { city: "Lubbock", state: "Texas", stateCode: "TX", county: "Lubbock County" },
  { city: "Corpus Christi", state: "Texas", stateCode: "TX", county: "Nueces County" },
  { city: "Midland", state: "Texas", stateCode: "TX", county: "Midland County" },

  // ── Florida ────────────────────────────────────────────────────────────────
  { city: "Miami", state: "Florida", stateCode: "FL", county: "Miami-Dade County" },
  { city: "Miami Beach", state: "Florida", stateCode: "FL", county: "Miami-Dade County" },
  { city: "Coral Gables", state: "Florida", stateCode: "FL", county: "Miami-Dade County" },
  { city: "Key Biscayne", state: "Florida", stateCode: "FL", county: "Miami-Dade County" },
  { city: "Fort Lauderdale", state: "Florida", stateCode: "FL", county: "Broward County" },
  { city: "Boca Raton", state: "Florida", stateCode: "FL", county: "Palm Beach County" },
  { city: "West Palm Beach", state: "Florida", stateCode: "FL", county: "Palm Beach County" },
  { city: "Palm Beach", state: "Florida", stateCode: "FL", county: "Palm Beach County" },
  { city: "Jupiter", state: "Florida", stateCode: "FL", county: "Palm Beach County" },
  { city: "Delray Beach", state: "Florida", stateCode: "FL", county: "Palm Beach County" },
  { city: "Orlando", state: "Florida", stateCode: "FL", county: "Orange County" },
  { city: "Tampa", state: "Florida", stateCode: "FL", county: "Hillsborough County" },
  { city: "St. Petersburg", state: "Florida", stateCode: "FL", county: "Pinellas County" },
  { city: "Clearwater", state: "Florida", stateCode: "FL", county: "Pinellas County" },
  { city: "Jacksonville", state: "Florida", stateCode: "FL", county: "Duval County" },
  { city: "Naples", state: "Florida", stateCode: "FL", county: "Collier County" },
  { city: "Sarasota", state: "Florida", stateCode: "FL", county: "Sarasota County" },
  { city: "Tallahassee", state: "Florida", stateCode: "FL", county: "Leon County" },
  { city: "Gainesville", state: "Florida", stateCode: "FL", county: "Alachua County" },
  { city: "Fort Myers", state: "Florida", stateCode: "FL", county: "Lee County" },
  { city: "Pensacola", state: "Florida", stateCode: "FL", county: "Escambia County" },
  { city: "Key West", state: "Florida", stateCode: "FL", county: "Monroe County" },

  // ── Illinois ───────────────────────────────────────────────────────────────
  { city: "Chicago", state: "Illinois", stateCode: "IL", county: "Cook County" },
  { city: "Evanston", state: "Illinois", stateCode: "IL", county: "Cook County" },
  { city: "Oak Park", state: "Illinois", stateCode: "IL", county: "Cook County" },
  { city: "Naperville", state: "Illinois", stateCode: "IL", county: "DuPage County" },
  { city: "Aurora", state: "Illinois", stateCode: "IL", county: "Kane County" },
  { city: "Rockford", state: "Illinois", stateCode: "IL", county: "Winnebago County" },
  { city: "Springfield", state: "Illinois", stateCode: "IL", county: "Sangamon County" },
  { city: "Champaign", state: "Illinois", stateCode: "IL", county: "Champaign County" },
  { city: "Highland Park", state: "Illinois", stateCode: "IL", county: "Lake County" },
  { city: "Lake Forest", state: "Illinois", stateCode: "IL", county: "Lake County" },
  { city: "Wilmette", state: "Illinois", stateCode: "IL", county: "Cook County" },
  { city: "Winnetka", state: "Illinois", stateCode: "IL", county: "Cook County" },

  // ── Pennsylvania ───────────────────────────────────────────────────────────
  { city: "Philadelphia", state: "Pennsylvania", stateCode: "PA", county: "Philadelphia County" },
  { city: "Pittsburgh", state: "Pennsylvania", stateCode: "PA", county: "Allegheny County" },
  { city: "Allentown", state: "Pennsylvania", stateCode: "PA", county: "Lehigh County" },
  { city: "Harrisburg", state: "Pennsylvania", stateCode: "PA", county: "Dauphin County" },
  { city: "State College", state: "Pennsylvania", stateCode: "PA", county: "Centre County" },
  { city: "Wayne", state: "Pennsylvania", stateCode: "PA", county: "Delaware County" },
  { city: "Bryn Mawr", state: "Pennsylvania", stateCode: "PA", county: "Montgomery County" },
  { city: "Ardmore", state: "Pennsylvania", stateCode: "PA", county: "Montgomery County" },
  { city: "King of Prussia", state: "Pennsylvania", stateCode: "PA", county: "Montgomery County" },

  // ── Massachusetts ──────────────────────────────────────────────────────────
  { city: "Boston", state: "Massachusetts", stateCode: "MA", county: "Suffolk County" },
  { city: "Cambridge", state: "Massachusetts", stateCode: "MA", county: "Middlesex County" },
  { city: "Brookline", state: "Massachusetts", stateCode: "MA", county: "Norfolk County" },
  { city: "Newton", state: "Massachusetts", stateCode: "MA", county: "Middlesex County" },
  { city: "Wellesley", state: "Massachusetts", stateCode: "MA", county: "Norfolk County" },
  { city: "Lexington", state: "Massachusetts", stateCode: "MA", county: "Middlesex County" },
  { city: "Concord", state: "Massachusetts", stateCode: "MA", county: "Middlesex County" },
  { city: "Worcester", state: "Massachusetts", stateCode: "MA", county: "Worcester County" },
  { city: "Springfield", state: "Massachusetts", stateCode: "MA", county: "Hampden County" },
  { city: "Salem", state: "Massachusetts", stateCode: "MA", county: "Essex County" },
  { city: "Nantucket", state: "Massachusetts", stateCode: "MA", county: "Nantucket County" },
  { city: "Martha's Vineyard", state: "Massachusetts", stateCode: "MA", county: "Dukes County" },
  { city: "Cape Cod", state: "Massachusetts", stateCode: "MA", county: "Barnstable County" },

  // ── Connecticut ────────────────────────────────────────────────────────────
  { city: "Greenwich", state: "Connecticut", stateCode: "CT", county: "Fairfield County" },
  { city: "Stamford", state: "Connecticut", stateCode: "CT", county: "Fairfield County" },
  { city: "Westport", state: "Connecticut", stateCode: "CT", county: "Fairfield County" },
  { city: "Darien", state: "Connecticut", stateCode: "CT", county: "Fairfield County" },
  { city: "New Canaan", state: "Connecticut", stateCode: "CT", county: "Fairfield County" },
  { city: "Bridgeport", state: "Connecticut", stateCode: "CT", county: "Fairfield County" },
  { city: "Hartford", state: "Connecticut", stateCode: "CT", county: "Hartford County" },
  { city: "New Haven", state: "Connecticut", stateCode: "CT", county: "New Haven County" },

  // ── New Jersey ─────────────────────────────────────────────────────────────
  { city: "Newark", state: "New Jersey", stateCode: "NJ", county: "Essex County" },
  { city: "Jersey City", state: "New Jersey", stateCode: "NJ", county: "Hudson County" },
  { city: "Hoboken", state: "New Jersey", stateCode: "NJ", county: "Hudson County" },
  { city: "Princeton", state: "New Jersey", stateCode: "NJ", county: "Mercer County" },
  { city: "Trenton", state: "New Jersey", stateCode: "NJ", county: "Mercer County" },
  { city: "Montclair", state: "New Jersey", stateCode: "NJ", county: "Essex County" },
  { city: "Summit", state: "New Jersey", stateCode: "NJ", county: "Union County" },
  { city: "Morristown", state: "New Jersey", stateCode: "NJ", county: "Morris County" },
  { city: "Short Hills", state: "New Jersey", stateCode: "NJ", county: "Essex County" },
  { city: "Red Bank", state: "New Jersey", stateCode: "NJ", county: "Monmouth County" },
  { city: "Atlantic City", state: "New Jersey", stateCode: "NJ", county: "Atlantic County" },
  { city: "Cape May", state: "New Jersey", stateCode: "NJ", county: "Cape May County" },

  // ── Washington ─────────────────────────────────────────────────────────────
  { city: "Seattle", state: "Washington", stateCode: "WA", county: "King County" },
  { city: "Bellevue", state: "Washington", stateCode: "WA", county: "King County" },
  { city: "Kirkland", state: "Washington", stateCode: "WA", county: "King County" },
  { city: "Redmond", state: "Washington", stateCode: "WA", county: "King County" },
  { city: "Mercer Island", state: "Washington", stateCode: "WA", county: "King County" },
  { city: "Issaquah", state: "Washington", stateCode: "WA", county: "King County" },
  { city: "Tacoma", state: "Washington", stateCode: "WA", county: "Pierce County" },
  { city: "Olympia", state: "Washington", stateCode: "WA", county: "Thurston County" },
  { city: "Spokane", state: "Washington", stateCode: "WA", county: "Spokane County" },
  { city: "Vancouver", state: "Washington", stateCode: "WA", county: "Clark County" },
  { city: "Bainbridge Island", state: "Washington", stateCode: "WA", county: "Kitsap County" },

  // ── Oregon ─────────────────────────────────────────────────────────────────
  { city: "Portland", state: "Oregon", stateCode: "OR", county: "Multnomah County" },
  { city: "Eugene", state: "Oregon", stateCode: "OR", county: "Lane County" },
  { city: "Salem", state: "Oregon", stateCode: "OR", county: "Marion County" },
  { city: "Bend", state: "Oregon", stateCode: "OR", county: "Deschutes County" },
  { city: "Lake Oswego", state: "Oregon", stateCode: "OR", county: "Clackamas County" },
  { city: "Beaverton", state: "Oregon", stateCode: "OR", county: "Washington County" },
  { city: "Ashland", state: "Oregon", stateCode: "OR", county: "Jackson County" },

  // ── Colorado ───────────────────────────────────────────────────────────────
  { city: "Denver", state: "Colorado", stateCode: "CO", county: "Denver County" },
  { city: "Boulder", state: "Colorado", stateCode: "CO", county: "Boulder County" },
  { city: "Colorado Springs", state: "Colorado", stateCode: "CO", county: "El Paso County" },
  { city: "Fort Collins", state: "Colorado", stateCode: "CO", county: "Larimer County" },
  { city: "Aspen", state: "Colorado", stateCode: "CO", county: "Pitkin County" },
  { city: "Vail", state: "Colorado", stateCode: "CO", county: "Eagle County" },
  { city: "Telluride", state: "Colorado", stateCode: "CO", county: "San Miguel County" },
  { city: "Aurora", state: "Colorado", stateCode: "CO", county: "Arapahoe County" },
  { city: "Lakewood", state: "Colorado", stateCode: "CO", county: "Jefferson County" },
  { city: "Cherry Hills Village", state: "Colorado", stateCode: "CO", county: "Arapahoe County" },

  // ── Arizona ────────────────────────────────────────────────────────────────
  { city: "Phoenix", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },
  { city: "Scottsdale", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },
  { city: "Tempe", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },
  { city: "Mesa", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },
  { city: "Chandler", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },
  { city: "Gilbert", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },
  { city: "Tucson", state: "Arizona", stateCode: "AZ", county: "Pima County" },
  { city: "Sedona", state: "Arizona", stateCode: "AZ", county: "Yavapai County" },
  { city: "Flagstaff", state: "Arizona", stateCode: "AZ", county: "Coconino County" },
  { city: "Paradise Valley", state: "Arizona", stateCode: "AZ", county: "Maricopa County" },

  // ── Nevada ─────────────────────────────────────────────────────────────────
  { city: "Las Vegas", state: "Nevada", stateCode: "NV", county: "Clark County" },
  { city: "Henderson", state: "Nevada", stateCode: "NV", county: "Clark County" },
  { city: "Reno", state: "Nevada", stateCode: "NV", county: "Washoe County" },
  { city: "Summerlin", state: "Nevada", stateCode: "NV", county: "Clark County" },

  // ── Georgia ────────────────────────────────────────────────────────────────
  { city: "Atlanta", state: "Georgia", stateCode: "GA", county: "Fulton County" },
  { city: "Savannah", state: "Georgia", stateCode: "GA", county: "Chatham County" },
  { city: "Augusta", state: "Georgia", stateCode: "GA", county: "Richmond County" },
  { city: "Athens", state: "Georgia", stateCode: "GA", county: "Clarke County" },
  { city: "Decatur", state: "Georgia", stateCode: "GA", county: "DeKalb County" },
  { city: "Marietta", state: "Georgia", stateCode: "GA", county: "Cobb County" },
  { city: "Buckhead", state: "Georgia", stateCode: "GA", county: "Fulton County" },
  { city: "Alpharetta", state: "Georgia", stateCode: "GA", county: "Fulton County" },
  { city: "Roswell", state: "Georgia", stateCode: "GA", county: "Fulton County" },

  // ── North Carolina ─────────────────────────────────────────────────────────
  { city: "Charlotte", state: "North Carolina", stateCode: "NC", county: "Mecklenburg County" },
  { city: "Raleigh", state: "North Carolina", stateCode: "NC", county: "Wake County" },
  { city: "Durham", state: "North Carolina", stateCode: "NC", county: "Durham County" },
  { city: "Chapel Hill", state: "North Carolina", stateCode: "NC", county: "Orange County" },
  { city: "Asheville", state: "North Carolina", stateCode: "NC", county: "Buncombe County" },
  { city: "Wilmington", state: "North Carolina", stateCode: "NC", county: "New Hanover County" },
  { city: "Greensboro", state: "North Carolina", stateCode: "NC", county: "Guilford County" },

  // ── Virginia ───────────────────────────────────────────────────────────────
  { city: "Arlington", state: "Virginia", stateCode: "VA", county: "Arlington County" },
  { city: "Alexandria", state: "Virginia", stateCode: "VA", county: "Alexandria County" },
  { city: "McLean", state: "Virginia", stateCode: "VA", county: "Fairfax County" },
  { city: "Fairfax", state: "Virginia", stateCode: "VA", county: "Fairfax County" },
  { city: "Reston", state: "Virginia", stateCode: "VA", county: "Fairfax County" },
  { city: "Richmond", state: "Virginia", stateCode: "VA", county: "Richmond County" },
  { city: "Virginia Beach", state: "Virginia", stateCode: "VA", county: "Virginia Beach County" },
  { city: "Charlottesville", state: "Virginia", stateCode: "VA", county: "Albemarle County" },

  // ── Maryland ───────────────────────────────────────────────────────────────
  { city: "Baltimore", state: "Maryland", stateCode: "MD", county: "Baltimore County" },
  { city: "Bethesda", state: "Maryland", stateCode: "MD", county: "Montgomery County" },
  { city: "Chevy Chase", state: "Maryland", stateCode: "MD", county: "Montgomery County" },
  { city: "Rockville", state: "Maryland", stateCode: "MD", county: "Montgomery County" },
  { city: "Annapolis", state: "Maryland", stateCode: "MD", county: "Anne Arundel County" },
  { city: "Columbia", state: "Maryland", stateCode: "MD", county: "Howard County" },
  { city: "Potomac", state: "Maryland", stateCode: "MD", county: "Montgomery County" },

  // ── Washington D.C. ────────────────────────────────────────────────────────
  { city: "Washington", state: "District of Columbia", stateCode: "DC", county: "District of Columbia" },

  // ── Michigan ───────────────────────────────────────────────────────────────
  { city: "Detroit", state: "Michigan", stateCode: "MI", county: "Wayne County" },
  { city: "Ann Arbor", state: "Michigan", stateCode: "MI", county: "Washtenaw County" },
  { city: "Grand Rapids", state: "Michigan", stateCode: "MI", county: "Kent County" },
  { city: "Birmingham", state: "Michigan", stateCode: "MI", county: "Oakland County" },
  { city: "Bloomfield Hills", state: "Michigan", stateCode: "MI", county: "Oakland County" },
  { city: "Troy", state: "Michigan", stateCode: "MI", county: "Oakland County" },
  { city: "Traverse City", state: "Michigan", stateCode: "MI", county: "Grand Traverse County" },

  // ── Ohio ───────────────────────────────────────────────────────────────────
  { city: "Columbus", state: "Ohio", stateCode: "OH", county: "Franklin County" },
  { city: "Cleveland", state: "Ohio", stateCode: "OH", county: "Cuyahoga County" },
  { city: "Cincinnati", state: "Ohio", stateCode: "OH", county: "Hamilton County" },
  { city: "Dayton", state: "Ohio", stateCode: "OH", county: "Montgomery County" },
  { city: "Akron", state: "Ohio", stateCode: "OH", county: "Summit County" },
  { city: "Shaker Heights", state: "Ohio", stateCode: "OH", county: "Cuyahoga County" },
  { city: "Dublin", state: "Ohio", stateCode: "OH", county: "Franklin County" },

  // ── Minnesota ──────────────────────────────────────────────────────────────
  { city: "Minneapolis", state: "Minnesota", stateCode: "MN", county: "Hennepin County" },
  { city: "St. Paul", state: "Minnesota", stateCode: "MN", county: "Ramsey County" },
  { city: "Edina", state: "Minnesota", stateCode: "MN", county: "Hennepin County" },
  { city: "Wayzata", state: "Minnesota", stateCode: "MN", county: "Hennepin County" },
  { city: "Rochester", state: "Minnesota", stateCode: "MN", county: "Olmsted County" },
  { city: "Duluth", state: "Minnesota", stateCode: "MN", county: "St. Louis County" },

  // ── Wisconsin ──────────────────────────────────────────────────────────────
  { city: "Milwaukee", state: "Wisconsin", stateCode: "WI", county: "Milwaukee County" },
  { city: "Madison", state: "Wisconsin", stateCode: "WI", county: "Dane County" },
  { city: "Green Bay", state: "Wisconsin", stateCode: "WI", county: "Brown County" },

  // ── Missouri ───────────────────────────────────────────────────────────────
  { city: "St. Louis", state: "Missouri", stateCode: "MO", county: "St. Louis County" },
  { city: "Kansas City", state: "Missouri", stateCode: "MO", county: "Jackson County" },
  { city: "Columbia", state: "Missouri", stateCode: "MO", county: "Boone County" },
  { city: "Clayton", state: "Missouri", stateCode: "MO", county: "St. Louis County" },

  // ── Tennessee ──────────────────────────────────────────────────────────────
  { city: "Nashville", state: "Tennessee", stateCode: "TN", county: "Davidson County" },
  { city: "Memphis", state: "Tennessee", stateCode: "TN", county: "Shelby County" },
  { city: "Knoxville", state: "Tennessee", stateCode: "TN", county: "Knox County" },
  { city: "Chattanooga", state: "Tennessee", stateCode: "TN", county: "Hamilton County" },

  // ── South Carolina ─────────────────────────────────────────────────────────
  { city: "Charleston", state: "South Carolina", stateCode: "SC", county: "Charleston County" },
  { city: "Greenville", state: "South Carolina", stateCode: "SC", county: "Greenville County" },
  { city: "Columbia", state: "South Carolina", stateCode: "SC", county: "Richland County" },
  { city: "Hilton Head Island", state: "South Carolina", stateCode: "SC", county: "Beaufort County" },
  { city: "Kiawah Island", state: "South Carolina", stateCode: "SC", county: "Charleston County" },

  // ── Louisiana ──────────────────────────────────────────────────────────────
  { city: "New Orleans", state: "Louisiana", stateCode: "LA", county: "Orleans Parish" },
  { city: "Baton Rouge", state: "Louisiana", stateCode: "LA", county: "East Baton Rouge Parish" },

  // ── Indiana ────────────────────────────────────────────────────────────────
  { city: "Indianapolis", state: "Indiana", stateCode: "IN", county: "Marion County" },
  { city: "Carmel", state: "Indiana", stateCode: "IN", county: "Hamilton County" },
  { city: "Bloomington", state: "Indiana", stateCode: "IN", county: "Monroe County" },

  // ── Utah ───────────────────────────────────────────────────────────────────
  { city: "Salt Lake City", state: "Utah", stateCode: "UT", county: "Salt Lake County" },
  { city: "Park City", state: "Utah", stateCode: "UT", county: "Summit County" },
  { city: "Provo", state: "Utah", stateCode: "UT", county: "Utah County" },
  { city: "St. George", state: "Utah", stateCode: "UT", county: "Washington County" },

  // ── Hawaii ─────────────────────────────────────────────────────────────────
  { city: "Honolulu", state: "Hawaii", stateCode: "HI", county: "Honolulu County" },
  { city: "Kailua", state: "Hawaii", stateCode: "HI", county: "Honolulu County" },
  { city: "Maui", state: "Hawaii", stateCode: "HI", county: "Maui County" },

  // ── Other notable cities ───────────────────────────────────────────────────
  { city: "Albuquerque", state: "New Mexico", stateCode: "NM", county: "Bernalillo County" },
  { city: "Santa Fe", state: "New Mexico", stateCode: "NM", county: "Santa Fe County" },
  { city: "Oklahoma City", state: "Oklahoma", stateCode: "OK", county: "Oklahoma County" },
  { city: "Tulsa", state: "Oklahoma", stateCode: "OK", county: "Tulsa County" },
  { city: "Omaha", state: "Nebraska", stateCode: "NE", county: "Douglas County" },
  { city: "Des Moines", state: "Iowa", stateCode: "IA", county: "Polk County" },
  { city: "Kansas City", state: "Kansas", stateCode: "KS", county: "Wyandotte County" },
  { city: "Overland Park", state: "Kansas", stateCode: "KS", county: "Johnson County" },
  { city: "Boise", state: "Idaho", stateCode: "ID", county: "Ada County" },
  { city: "Sun Valley", state: "Idaho", stateCode: "ID", county: "Blaine County" },
  { city: "Burlington", state: "Vermont", stateCode: "VT", county: "Chittenden County" },
  { city: "Portland", state: "Maine", stateCode: "ME", county: "Cumberland County" },
  { city: "Providence", state: "Rhode Island", stateCode: "RI", county: "Providence County" },
  { city: "Newport", state: "Rhode Island", stateCode: "RI", county: "Newport County" },
  { city: "Manchester", state: "New Hampshire", stateCode: "NH", county: "Hillsborough County" },
  { city: "Hanover", state: "New Hampshire", stateCode: "NH", county: "Grafton County" },
  { city: "Wilmington", state: "Delaware", stateCode: "DE", county: "New Castle County" },
  { city: "Jackson", state: "Wyoming", stateCode: "WY", county: "Teton County" },
  { city: "Billings", state: "Montana", stateCode: "MT", county: "Yellowstone County" },
  { city: "Missoula", state: "Montana", stateCode: "MT", county: "Missoula County" },
  { city: "Whitefish", state: "Montana", stateCode: "MT", county: "Flathead County" },
  { city: "Sioux Falls", state: "South Dakota", stateCode: "SD", county: "Minnehaha County" },
  { city: "Fargo", state: "North Dakota", stateCode: "ND", county: "Cass County" },
  { city: "Little Rock", state: "Arkansas", stateCode: "AR", county: "Pulaski County" },
  { city: "Anchorage", state: "Alaska", stateCode: "AK", county: "Anchorage Borough" },
  { city: "Birmingham", state: "Alabama", stateCode: "AL", county: "Jefferson County" },
  { city: "Huntsville", state: "Alabama", stateCode: "AL", county: "Madison County" },
  { city: "Lexington", state: "Kentucky", stateCode: "KY", county: "Fayette County" },
  { city: "Louisville", state: "Kentucky", stateCode: "KY", county: "Jefferson County" },
  { city: "Jackson", state: "Mississippi", stateCode: "MS", county: "Hinds County" },
  { city: "Charleston", state: "West Virginia", stateCode: "WV", county: "Kanawha County" },

  // ── UK (for existing demo data compatibility) ──────────────────────────────
  { city: "London", state: "England", stateCode: "UK", county: "Greater London" },
  { city: "Manchester", state: "England", stateCode: "UK", county: "Greater Manchester" },
  { city: "Birmingham", state: "England", stateCode: "UK", county: "West Midlands" },
  { city: "Bristol", state: "England", stateCode: "UK", county: "City of Bristol" },
  { city: "Edinburgh", state: "Scotland", stateCode: "UK", county: "City of Edinburgh" },
  { city: "Glasgow", state: "Scotland", stateCode: "UK", county: "City of Glasgow" },
  { city: "Liverpool", state: "England", stateCode: "UK", county: "Merseyside" },
  { city: "Oxford", state: "England", stateCode: "UK", county: "Oxfordshire" },
  { city: "Cambridge", state: "England", stateCode: "UK", county: "Cambridgeshire" },
  { city: "Bath", state: "England", stateCode: "UK", county: "Bath and North East Somerset" },
  { city: "Leeds", state: "England", stateCode: "UK", county: "West Yorkshire" },
  { city: "Brighton", state: "England", stateCode: "UK", county: "East Sussex" },
  { city: "Wimbledon", state: "England", stateCode: "UK", county: "Greater London" },
];

/**
 * Search cities by query string.
 * Returns results ranked: exact match > starts-with > contains.
 */
export function searchCities(query: string, limit = 10): CityRecord[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const exact: CityRecord[] = [];
  const startsWith: CityRecord[] = [];
  const contains: CityRecord[] = [];

  for (const c of US_CITIES) {
    const cityLower = c.city.toLowerCase();
    const fullCode = `${c.city}, ${c.stateCode}`.toLowerCase();
    const fullState = `${c.city}, ${c.state}`.toLowerCase();
    const countyLower = c.county.toLowerCase();

    if (cityLower === q || fullCode === q || fullState === q) {
      exact.push(c);
    } else if (cityLower.startsWith(q) || fullCode.startsWith(q) || fullState.startsWith(q)) {
      startsWith.push(c);
    } else if (cityLower.includes(q) || countyLower.includes(q) || fullState.includes(q)) {
      contains.push(c);
    }
  }

  return [...exact, ...startsWith, ...contains].slice(0, limit);
}
