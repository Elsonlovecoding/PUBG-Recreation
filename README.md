# PUBG Recreation

A low-poly battle royale shooter for the browser, built with [Three.js](https://threejs.org/) (r128 via cdnjs). No build step, no server — open `pubg.html` in any modern browser and click **Deploy**.

![genre](https://img.shields.io/badge/genre-battle%20royale-f2a900) ![tech](https://img.shields.io/badge/three.js-r128-049EF4)

## How to play

From the lobby, customize your character and weapon slots, hit PLAY, and queue into a match. A cargo plane then carries 40 combatants across a 2 km × 2 km island — pick your moment, press F, and parachute in. Last one standing wins the chicken dinner. Stay inside the shrinking blue zone, loot crates for typed ammo, armor, medkits and grenades, grab a roadside buggy to rotate, and watch the kill feed. The island has four villages, a military depot, a quarry, farms with silos, watchtowers, lone houses and a lake, all linked by dirt roads.

| Input | Action |
|---|---|
| **WASD** | Move |
| **Mouse** | Look / shoot (click to grab pointer lock) |
| **Right click (hold)** | Aim — full scope zoom on the sniper |
| **Shift** | Sprint |
| **Space** | Jump |
| **R** | Reload |
| **1 / 2 / 3** | Switch between rifle / shotgun / sniper |
| **E** | Open the inventory — click a medkit or grenade to take it in hand |
| **Click** (item in hand) | Apply the medkit (4s cast) or throw the grenade |
| **F** | Jump from the plane · enter / exit a vehicle (prompt appears when close) |
| **V** | Toggle first / third person — works while parachuting too |
| **Click** (sniper, scoped) | Fires immediately |
| **Double-click** (sniper) | Latch the scope — stays on while you shoot; right-click exits |
| **Hold click** (sniper, hip) | Charge the shot — fires when you release |

## Project layout

```
pubg.html          entry point (HUD markup + script includes)
css/style.css      HUD, menus, inventory, kill feed styling
js/utils.js        math helpers + seeded simplex noise
js/audio.js        procedural sound — all effects synthesized with Web Audio
js/scene.js        renderer, camera, gradient sky dome, sun + fill lights
js/terrain.js      village/road layout, noise heightfield, vertex-colored terrain chunks
js/world.js        water, mountains, clouds, trees/rocks/grass, buildings + colliders
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
- Sniper scope lock: double-click to latch the scope and keep firing scoped shots; right-click drops back out (hold right-click still works for quick peeks)
- PUBG-style lobby inside a private hangar: your character stands full-height on a lit spawn pad; profile card with editable name/level top-left, WARDROBE / LOADOUT / STATISTICS / CONTROLS cards top-right, rotating tips above a big angled gold START; wardrobe and weapon-slot choices persist, and matchmaking runs as a banner before deploying

- Procedural 2 km × 2 km island with domain-warped ridgelines, crisp dirt roads, sand beaches and a lake; ~63 buildings across eleven settlement sites
- Building variety: houses, two-storey houses, walk-up apartments with real second floors and outside staircases (bonus loot upstairs), barns, sheds, flat-roof warehouses with roll doors, farm silos and hilltop watchtowers, in six paint palettes
- Third-person view on V — see your own character (with your actual weapon in hand), over-shoulder camera with collision, automatic during the parachute drop
- The match opens with a cargo-plane drop; all 39 bots bail out along the flight path under their own canopies
- Full procedural soundscape (Web Audio, no files): panned distance-muffled gunshots, footsteps, reloads, explosions, sirens, engine/plane/freefall loops
- Loot with typed ammo — 5.56 for the rifle, 12-gauge shells, 7.62 for the sniper — plus armor vests, medkits, frag and smoke grenades, all as recognizable 3D models
- Real smoke: soft round sprite clouds ~18 m across that sit where they land for 20 seconds and genuinely blind bots (inside or through)
- Armor bar soaks 70% of damage; bots' helmets and vests grant them the same protection
- Eight buggies parked along the roads with a PUBG-style "F — DRIVE" prompt, slope physics, run-overs and explosive wrecks
- 39 bots that hear gunfire, hunt attackers, loot crates, heal behind cover, throw grenades, and rotate to the next zone circle early
- Sniper: click fires instantly when scoped; from the hip, hold and release for a deliberate shot
- Shrinking zone with countdown timers on every phase; kill feed, kills counter, minimap with flight path
- End screen with placement banner and stat tiles (kills, damage, accuracy, survival time) plus persistent career stats
