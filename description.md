I want to build an interactive "tree of life" explorer as a web app. Please help me plan and build it, starting with a working prototype.

## Concept
- Circular, radial branched tree. The currently focused taxon sits in the CENTER; 2–3 rings of descendants radiate outward to fill the circle.
- Tapping/clicking a node makes it the new center, with a smooth animated transition. A way back up (tap center or breadcrumb) re-centers on the parent.
- Hovering (desktop) or tapping (touch) a node shows a small card with an image, scientific name and common name.

## Data
- Primary source: Open Tree of Life API (~2.3M species). Use its tree_of_life / taxonomy endpoints to get a node's children; check the current API docs for exact endpoints.
- Two loading strategies to evaluate:
  1. Lazy: fetch 2–3 levels below the focused node on demand, cache by node ID.
  2. Preload: ship the whole topology in a compact compressed format (OneZoom does this, then layers names/images on top asynchronously). Makes animations never wait on the network.
  Start with lazy for the prototype, keep the data layer swappable.
- Images & common names: iNaturalist taxa API (default_photo + preferred_common_name) as the main source; Wikidata (has an Open Tree of Life ID property, so no name matching needed) and GBIF as fallbacks.

## Tree shape problems to handle
- Polytomies: many nodes have dozens to thousands of children (unresolved relationships, flat taxonomy fallback, real rapid radiations). Cap visible children at ~15–20 by descendant count, add a "+N more" wedge that expands or opens a list.
- Long chains of single-child or binary nodes: collapse them into one visual edge until the user drills in.
- Angle allocation: weight each wedge by descendant count (probably log-scaled) so rings fill evenly.

## Layout
- d3.hierarchy + d3.cluster()/d3.tree() with size [2π, radius]. Links drawn as radial "step" links (arc + radial segment).
- Labels rotated along the radius, flipped on the left half for readability; hide labels that would overlap.

## Animation (most important part to get right)
- Stable node IDs + keyed D3 joins so persisting nodes move rather than redraw.
- Interpolate in POLAR coordinates (angle, radius), never x/y, so branches swing around the circle instead of cutting across it. Take the shortest angular path.
- On re-center: clicked node moves to radius 0, old parent/siblings fade out beyond the edge, new grandchildren grow outward from their parent's position. One ~600ms ease for everything.
- Recompute link paths every frame from interpolated polar values.
- Should stay smooth on a mid-range phone; switch to canvas if SVG struggles.

## Preview card
- Debounce hover ~150ms before fetching; cache by node ID; prefetch for visible children of the center.
- Show scientific name instantly, fade the image in when loaded.
- No photo (common for higher clades)? Fall back to a representative descendant's photo ("e.g. Panthera leo").
- Touch: first tap = preview, second tap or a button = re-center.
- Show photo attribution/licence (iNaturalist/Wikimedia photos are mostly Creative Commons and need credit).

## Prior art to look at (not to copy)
- OneZoom (onezoom.org): fractal zoom, open source, good reference for data pipeline and ID mapping between sources.
- Lifemap: map-style zoomable tree with node info.
Neither does the re-centering radial interaction, which is the point of this project.

## Suggested first milestones
1. Static radial layout from a small hard-coded sample tree (e.g. mammals, a few levels).
2. Re-centering with polar-interpolated animation on that sample.
3. Swap in live Open Tree data with caching, child capping and chain collapsing.
4. Preview card with images, names and attribution.
5. Performance pass and mobile polish.

Please start by suggesting a stack and file structure, then build milestone 1 and 2 so I can feel how the animation works.