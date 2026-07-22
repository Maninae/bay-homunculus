# Data Sources for Bay Area Travel Times

Research notes, July 2026. This is the groundwork for the pipeline: what data exists, what it costs, and what role each source plays.

## The framing that makes this cheap

We do not need an origin-destination travel-time dataset. We compute all pairwise times ourselves with Dijkstra over the OpenStreetMap street graph. External data is only needed for three narrow things:

1. **The street network itself** (geometry, speed limits, one-way rules): free from OSM.
2. **A congestion signal** (how much slower each segment is at rush hour than free-flow): the only part that touches a commercial API, and only as per-segment multipliers, not full routes.
3. **Transit schedules** (for the transit variant): free GTFS.

This turns "where do we buy a travel-time matrix" into "where do we sample a few thousand speed readings," which fits in free tiers.

## 1. Street network: OpenStreetMap

- **Overpass API** for a bounded extract of drivable ways. Fine for a city-scale bounding box (tiled queries), slow and rude for nine counties.
- **[Geofabrik NorCal extract](https://download.geofabrik.de/north-america/us/california/norcal.html)**: a daily-updated `.osm.pbf` of Northern California. The better path at Bay scale; clip to our bounding box locally.
- Tags of interest: `highway`, `maxspeed`, `oneway`. Apply default speeds where `maxspeed` is missing (25 mph residential, 65 mph motorway).
- License: ODbL. Free for any use with attribution.

## 2. Congestion signal

### TomTom Traffic API (primary)

- [Flow Segment Data endpoint](https://developer.tomtom.com/traffic-api/documentation/traffic-flow/flow-segment-data): give it a lat/lon, get current speed vs. free-flow speed for the nearest road segment.
- Free tier ([pricing docs](https://docs.tomtom.com/pricing)): 2,500 non-tile requests/day plus 50,000 tile requests/day, no credit card, commercial use allowed.
- Sampling plan: one reading near each anchor point per scenario. A ~1,000-point grid sampled during Friday 5-6pm fits in a single day's free tier; a denser freeway-focused sweep fits in two or three.
- Caveat: TomTom announced a pricing revision effective July 2026. Recheck the free-tier terms right before the sampling run.
- Sampling design: average the few nearest readings within 1.5 km, distance-weighted, and cap the multiplier at 4x so one stuck sensor cannot poison an edge.

### Caltrans PeMS (freeway ground truth, Bay-specific bonus)

- [PeMS](https://pems.dot.ca.gov) publishes measured speed/flow/occupancy from 39,000+ loop detectors on California freeways, including every Bay Area bridge approach. Free account required.
- Strengths: real measured speeds by time-of-day and day-of-week, historical depth, exactly where the Bay's pain lives (bridges and freeway merges).
- Limitation: freeways only. Arterials (19th Ave, San Pablo, El Camino) need TomTom or a modeled profile.
- Role: calibrate and sanity-check the freeway multipliers TomTom gives us, and optionally build the "Friday evening" profile from historical PeMS instead of live sampling.

### Fallbacks and alternatives

- **Modeled congestion profiles**: a no-API-key mode with modeled slowdown profiles by road class and corridor. The zero-dependency fallback, and what v1 ships with until API keys arrive.
- **HERE Traffic API**: freemium alternative to TomTom (250k transactions/month tier) if TomTom's July 2026 pricing change kills the free tier.

## 3. Transit: 511.org Open Data

- [511 SF Bay Open Data](https://511.org/open-data/transit) publishes a single consolidated regional GTFS feed (operator code `RG`) covering all Bay Area operators: BART, Muni, Caltrain, AC Transit, VTA, SamTrans, ferries, everything.
- Static feed: `https://api.511.org/transit/datafeeds?api_key=KEY&operator_id=RG`. Free API key by [request form](https://511.org/open-data/token), issued after email verification.
- GTFS-RT (trip updates, vehicle positions) also exists but is unnecessary here; scheduled times are what we want.
- Routing: RAPTOR over the timetable, walk-access to stops, take the better of transit vs. walking.

## 4. Validation only: Google Routes API

Google's traffic-aware Routes / Distance Matrix is the quality benchmark, but its terms prohibit caching results or building derived datasets from them, so it cannot be the base data for a published map. Legitimate role: spot-check 20-30 of our computed pairs (bridge crossings, 280 vs. 101, a transit trip) against Google's estimates within the free monthly allotment, and report the deltas as an accuracy note.

## Dead ends, so nobody re-litigates them

| Source | Verdict |
|---|---|
| **Uber Movement** | Discontinued (~2023). It had exactly this: SF O/D travel times by hour. Archived CSVs (2016-2019) survive in [tutorials](https://www.qgistutorials.com/en/docs/3/travel_time_analysis.html) and mirrors; usable as a historical curiosity, not current data. |
| **NPMRDS** (FHWA probe data) | Restricted to state DOTs, MPOs, and their contractors. Not available to individuals. |
| **INRIX / StreetLight / Replica** | Commercial licenses, enterprise pricing. No. |

## Recommended stack

| Need | Source |
|---|---|
| Streets + speeds | Geofabrik NorCal OSM extract |
| Free-flow times | Our own Dijkstra over the OSM graph |
| Congestion multipliers | TomTom Flow Segment (free tier), calibrated against PeMS on freeways |
| Transit | 511.org regional GTFS + RAPTOR |
| Fallback | Modeled congestion profiles (no API key needed) |
| Accuracy note | Google Routes spot checks (never stored as base data) |

## Bay-specific scoping notes

- **Grid budget**: the all-pairs matrix grows as N². The nine-county Bay at 500 m hex spacing would be ~20,000 points (unworkable). Keep N near 1,000 by widening spacing (1.5-2 km) or shrinking the region. v1 scope: SF + Peninsula to Palo Alto + East Bay from Richmond to Hayward, which captures every famous chokepoint.
- **The eight bridges** (Golden Gate, Bay, Richmond-San Rafael, San Mateo-Hayward, Dumbarton, Carquinez, Benicia, Antioch) are the only water crossings, so expect the two shores to hinge around them dramatically. A flat page cannot honor every crossing time at once when the water sits in the middle of the map, so embedding stress will be high, and that is the fun part.
- **Expected distortions to look for**: shores pulling apart except at bridge landings; 280 and 101 compressing the Peninsula lengthwise while 19th Ave and El Camino stay long; BART making the transit map fold the East Bay toward downtown SF.
