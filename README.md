# Bay Homunculus

**The Bay Area redrawn so that distance means travel time.**

<p align="center">
  <img src="https://img.shields.io/badge/status-research-blue" alt="Status: research">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT">
</p>

---

The cortical homunculus draws the human body the way the brain feels it: huge hands, huge lips, a tiny torso. This project draws the Bay Area the way a driver feels it. The two miles across a bridge approach swell into a long haul, and the ten freeway miles down 280 shrink to almost nothing. Everyone who lives here knows the Bay's signature move: a crossing you could kayak in 20 minutes takes 45 by car at 5pm.

The plan is a map you can morph with a slider. At one end, familiar geography. At the other, a version of the Bay where every pair of points sits as far apart as the drive between them actually takes, computed from real street networks, real traffic, and real transit schedules.

The Bay should warp more dramatically than almost any city you could try this on: eight toll bridges, two parallel freeway spines, and a body of water in the middle of the map.

## How it works

The key insight: you don't need to buy an origin-destination travel-time dataset. You compute travel times yourself by routing over the free OpenStreetMap street network, and only need external data for two things: how traffic slows each road segment, and when transit runs.

1. **Sample the region.** Lay a hexagonal grid of anchor points over the Bay, drop the ones in water, and keep roughly 1,000 points so the all-pairs matrix stays tractable (about 500k routes).
2. **Build the street graph.** Drivable roads from OpenStreetMap with speed limits and one-way rules, then Dijkstra between every pair of anchors for free-flow times.
3. **Add traffic.** Per-segment congestion multipliers from a traffic API (and Caltrans freeway sensors) turn free-flow times into Friday-at-5pm times.
4. **Add transit.** The 511.org regional GTFS feed covers every Bay Area operator in one file; RAPTOR routing over it gives transit travel times.
5. **Embed.** Multidimensional scaling (classical MDS, then SMACOF refinement) finds 2D positions whose distances match the travel times, and Procrustes alignment rotates the result back onto geographic north.
6. **Morph.** A static viewer interpolates each point between its geographic and time-space positions.

Some travel-time sets cannot be drawn on a flat page at all (two neighborhoods equidistant from a bridge cannot both keep their times), so the viewer will also show per-point stress: where the map had to lie to fit the page.

## Where the data comes from

| Source | Provides | Cost |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org) (Overpass / [Geofabrik](https://download.geofabrik.de/north-america/us/california/norcal.html)) | Streets, speed limits, one-way rules, shorelines | Free (ODbL) |
| [TomTom Traffic API](https://developer.tomtom.com/traffic-api/documentation/traffic-flow/flow-segment-data) | Live per-segment congestion (free tier: 2,500 non-tile requests/day) | Free tier |
| [Caltrans PeMS](https://pems.dot.ca.gov) | Measured freeway speeds from 39,000+ loop detectors statewide | Free account |
| [511.org Open Data](https://511.org/open-data/transit) | One regional GTFS feed for all Bay Area transit operators | Free API key |

The full research on what's available, what's dead (RIP Uber Movement), and what's legally off-limits for building derived maps lives in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Status

Research phase. The data-source groundwork is done; the pipeline is next.

- [x] Identify Bay Area data sources for streets, traffic, and transit
- [ ] Scope the region and grid (SF + inner Bay vs. all nine counties)
- [ ] Build the routing pipeline and free-flow matrix
- [ ] Add congested and transit variants
- [ ] MDS/SMACOF embedding and stress diagnostics
- [ ] Morphing viewer on GitHub Pages

## Credits

Street data © OpenStreetMap contributors.

## License

[MIT](LICENSE)
