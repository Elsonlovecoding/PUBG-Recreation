# PUBG Recreation

A low-poly battle royale shooter for the browser, built with [Three.js](https://threejs.org/) (r128 via cdnjs). No build step, no server — open `pubg.html` in any modern browser and click **Deploy**.

![genre](https://img.shields.io/badge/genre-battle%20royale-f2a900) ![tech](https://img.shields.io/badge/three.js-r128-049EF4)

## How to play

A cargo plane carries 40 combatants across a 1 km × 1 km island — pick your moment, press F, and parachute in. Last one standing wins the chicken dinner. Stay inside the shrinking blue zone, loot crates for ammo, armor, medkits and grenades, grab a buggy to rotate, and watch the kill feed. The island has three villages, a military depot, farms, lone houses and a lake, all linked by dirt roads.

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
| **F** | Jump from the plane · enter / exit a vehicle |
| **Hold click** (sniper) | Charge the shot — the bullet fires when you release |

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
js/items.js        inventory, held items, grenades, explosions, loot pickup
js/vehicle.js      drivable buggies
js/drop.js         the cargo plane, freefall and parachutes
js/game.js         shrinking zone, minimap, HUD, career stats, match flow, main loop
```

The scripts are classic (non-module) and load in dependency order, so the game runs directly from `file://`.

## Features

- Procedural 1 km × 1 km terrain colored by height and slope — grass, dirt, rock, sand beaches, a lake — with a road network connecting 34 buildings across six settlements
- Full procedural soundscape: gunshots with distance muffling and stereo panning, footsteps, reloads, explosions, zone sirens, engine/plane/freefall loops — all synthesized, no audio files
- The match opens with a cargo-plane drop: pick your exit, freefall with steering, parachute in — the 39 bots bail out along the flight path too
- Custom shaders: animated water with sun glints, per-fragment ground grain, drifting cloud shadows, gradient sky, striped zone force-field
- Trees and boulders have real hitboxes — trunks block movement and bullets, canopies block line of sight
- E-key inventory with held items: medkits (4s cast), frag grenades with arc, bounce and cover-aware blast damage, smoke grenades that block bot vision
- Armor with visible blue bar — soaks 70% of incoming damage while it lasts; bots wear it too (their helmets and vests are real)
- Five drivable buggies: slope-following arcade physics, run-overs, engine audio, explosive wrecks
- 39 bots that parachute in, roam between settlements, hear gunfire and investigate, hunt whoever shot them, heal with their own medkits behind cover, lob grenades at campers, and predict the next zone circle
- Career stats saved in the browser: matches, wins, kills, best placement — plus per-match damage, accuracy and survival time on the end screen
- Shrinking zone with countdown timers, kill feed, minimap with flight path and zone circles, victory & death screens
