# PUBG Recreation

A stylized-realistic battle royale shooter for the browser, built with [Three.js](https://threejs.org/) (r128 via cdnjs). No build step, no server, and still zero asset files — every texture is generated procedurally at boot. Open `pubg.html` in any modern browser and click **Deploy**.

![genre](https://img.shields.io/badge/genre-battle%20royale-f2a900) ![tech](https://img.shields.io/badge/three.js-r128-049EF4)

## How to play

From the lobby, customize your character and weapon slots, hit PLAY, and queue into a match. A cargo plane then carries 40 combatants across a 4 km × 4 km island — pick your moment, press F, and steer your freefall to the spot you want. Last one standing wins the chicken dinner. Stay inside the shrinking blue zone, loot crates for typed ammo, armor, medkits and grenades, grab a roadside buggy to rotate, and watch the kill feed. The island has Karona City with its concrete tower blocks, villages, coastal capes and shore camps in every quarter, a military depot, a quarry, farms with silos, watchtowers, lone houses, a lake and five snow-capped ridge massifs — all linked by paved highways and long dirt routes.

| Input | Action |
|---|---|
| **WASD** | Move |
| **Mouse** | Look / shoot (click to grab pointer lock) |
| **Right click (hold)** | Aim — full scope zoom on the sniper |
| **Shift** | Sprint |
| **Space** | Jump |
| **R** | Reload |
| **1 / 2 / 3** | Switch between rifle / shotgun / sniper |
| **E** | Open the inventory — use medkits/grenades and check your equipped armor |
| **Click** (item in hand) | Apply the medkit (4s cast) or throw the grenade |
| **F** | Jump from the plane · enter / exit a vehicle (prompt appears when close) |
| **E / M** (driving) | Both work at the wheel — browse your inventory or check the map while you drive |
| **V** | Toggle first / third person — works while parachuting too |
| **M** | Open the full island map — place names, zone, flight path; the corner minimap shows the 500 m around you |
| **Click** (sniper, scoped) | Fires immediately |
| **Double-click** (sniper) | Toggle the scope — stays on while you shoot; double-click again to drop it |
| **Hold click** (sniper, hip) | Charge the shot — fires when you release |

## Project layout

```
pubg.html          entry point (HUD markup + script includes)
css/style.css      HUD, menus, inventory, kill feed styling
js/utils.js        math helpers + seeded simplex noise
js/audio.js        procedural sound — all effects synthesized with Web Audio
js/detail.js       procedural tileable detail textures (grass/dirt/rock/sand/snow/asphalt)
js/scene.js        renderer, camera, sky dome, two-tier sun shadows, aerial-perspective fog
js/terrain.js      village/road layout, ridged heightfield, per-pixel splat-textured terrain
js/world.js        water, horizon, clouds, trees/rocks, buildings + colliders, baked AO
js/grass.js        instanced wind-swaying grass ring around the player
js/combat.js       hitscan raycasting, weapon stats, loot crates
js/effects.js      particle pools, bullet tracers, impact FX
js/player.js       player state, gun viewmodels, shooting, input, movement
js/bots.js         humanoid bots — AI, walk animation, ragdolls, damage + kills
js/avatar.js       third-person view: player character + orbit camera
js/items.js        inventory, held items, grenades, smoke, explosions, loot pickup
js/vehicle.js      drivable buggies
js/drop.js         the cargo plane, freefall and parachutes
js/game.js         shrinking zone, minimap, HUD, career stats, match flow, main loop
js/lobby.js        lobby menu — avatar customization, weapon-slot settings, play queue
```

The scripts are classic (non-module) and load in dependency order, so the game runs directly from `file://`.

## Features

- Profile screen (click your player icon): pick from eight generated avatar icons or upload your own image, see your level with an escalating points curve (kills, damage and placement earn points each match), and browse your battle log of recent matches
- Sniper scope lock: double-click to latch the scope and keep firing scoped shots; double-click again to drop back out (hold right-click still works for quick peeks)
- PUBG-style lobby inside a private hangar: your character stands full-height on a lit spawn pad; profile card with editable name/level top-left, WARDROBE / LOADOUT / STATISTICS / CONTROLS cards top-right, rotating tips above a big angled gold START; wardrobe and weapon-slot choices persist, and matchmaking runs as a banner before deploying

- Procedural 4 km × 4 km island with domain-warped hills and five ridged-noise mountain massifs that rise past 140 m into bare rock strata and snowcaps (trees stop at the treeline), sand beaches and a lake; ~92 buildings across nineteen settlement sites (road-distance queries are AABB-gated, so the whole heightfield still generates in a couple of seconds)
- Per-pixel terrain materials with zero asset files: procedurally generated tileable grass, dirt, rock, sand, snow and asphalt detail textures are splat-blended per pixel by slope, altitude and road maps — so roads have crisp painted edges instead of vertex smears, cliffs show strata, and the ground reads as material up close
- Smooth analytic terrain normals (no more 4 m facets), baked ambient occlusion grounding every building, tree and rock, and a triplanar concrete grain on all structures
- A mixed forest of ~3,800 trees — layered conifers and round-canopy deciduous trees with noise-lumped crowns and dappled per-vertex color — plus 800 smooth lumpy boulders (subdivided, noise-displaced, squashed), every one of which blocks movement and bullets
- Landmark structures beyond the villages: a red-and-white lighthouse on the southeast cape, a radio mast with dishes high on the eastern massif, a three-turbine wind farm with lazily spinning rotors, a fuel station with canopy and pumps on Oakfield main street, hay bales, paddock fences you can vault, and power poles lining the paved routes
- Soft billboard clouds — layered procedural cumulus sprites that drift and fade into the haze — replace the old solid blobs
- Two-tier sun shadows — a crisp near map plus a coarse map reaching ~250 m — erase the old shadow cutoff line, while aerial-perspective fog desaturates with distance and warms toward the sun
- Karona City: four concrete high-rise towers (15–24 m, full window grids and parapets) plus apartments, a warehouse and houses on a paved street grid
- Tower interiors are real: a concrete storey every 3 m linked by solid scissor staircases with stepped balustrades, loot crates on two floors, and a final flight through a rooftop stairhouse onto the roof — a sniper prize crate waits up there behind the parapet
- Building variety grew again: gable-roofed cottages with porches and chimneys, and walk-up apartments that split between outside staircases and proper interior stairwells with an opening in the second floor
- Real roads: asphalt-colored paved avenues and arterials with worn dirt shoulders link the city, villages and depot, while farm tracks stay dirt — and buggies park along both
- Building variety: houses, two-storey houses, walk-up apartments with real second floors and outside staircases (bonus loot upstairs), barns, sheds, flat-roof warehouses with roll doors, farm silos and hilltop watchtowers, in six paint palettes (plus two concrete facades for the towers)
- Third-person view on V — see your own character (with your actual weapon in hand), over-shoulder camera with collision, automatic during the parachute drop
- The match opens with a cargo-plane drop from a C-130-style transport — tube fuselage, high wing, four spinning turboprops and a red-banded tail; all 39 bots bail out along the flight path under their own canopies
- Steerable skydive: WASD steers the freefall and the canopy — lean into a direction to glide (slower fall, real horizontal reach) or keep your hands off to plummet straight down, so you genuinely pick your landing spot
- Full procedural soundscape (Web Audio, no files): panned distance-muffled gunshots, footsteps, reloads, explosions, sirens, engine/plane/freefall loops
- Loot with typed ammo — 5.56 for the rifle, 12-gauge shells, 7.62 for the sniper — plus armor vests, medkits, frag and smoke grenades, all as recognizable 3D models
- Real smoke: soft round sprite clouds ~18 m across that sit where they land for 20 seconds and genuinely blind bots (inside or through)
- Three armor pieces — shirt armor, helmet, boots — in three levels each, found only as loot (you start with none); higher-level pieces replace lower ones, total damage reduction reaches 35%, the E-inventory lists your equipment, and an equipped helmet shows on your character; bots' visible helmets and vests grant them the same protection
- Fifteen buggies parked along the roads (two in the city) with a PUBG-style "F — DRIVE" prompt, slope physics and explosive wrecks — rebuilt with roll cages, seats, steering wheel, headlights, door panels, spare wheel and hub-detailed rolling wheels; run-overs are lethal (even a max-armor fighter dies under your wheels at speed)
- Driving is safer under fire: bots find a moving car much harder to hit, the buggy's body soaks about half of what would land on you, and the rest is blunted by the frame — while you can still browse the inventory and map from the driver's seat
- Characters carry baked shading (sky-lit from above, shaded feet), chest rigs, belt pouches and knee pads over their gear
- 39 bots that hear gunfire, hunt attackers, loot crates, heal behind cover, throw grenades, and rotate to the next zone circle early
- Sniper: click fires instantly when scoped; from the hip, hold and release for a deliberate shot
- Shrinking zone with countdown timers on every phase; kill feed, kills counter; the corner minimap is a 500 m local view centered on you, and M opens the full island map with named settlements, a 500 m grid, zone circles and the live flight path
- End screen with placement banner and stat tiles (kills, damage, accuracy, survival time) plus persistent career stats
