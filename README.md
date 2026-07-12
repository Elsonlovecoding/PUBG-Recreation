# PUBG Recreation

A low-poly battle royale shooter for the browser, built with [Three.js](https://threejs.org/) (r128 via cdnjs). No build step, no server — open `pubg.html` in any modern browser and click **Deploy**.

![genre](https://img.shields.io/badge/genre-battle%20royale-f2a900) ![tech](https://img.shields.io/badge/three.js-r128-049EF4)

## How to play

You drop onto a 500×500 island with 15 bots, carrying all three weapons — rifle, shotgun and sniper. Last one standing wins the chicken dinner. Stay inside the shrinking blue zone, loot crates in the village buildings for ammo and medkits, and watch the kill feed.

| Input | Action |
|---|---|
| **WASD** | Move |
| **Mouse** | Look / shoot (click to grab pointer lock) |
| **Right click (hold)** | Aim — full scope zoom on the sniper |
| **Shift** | Sprint |
| **Space** | Jump |
| **R** | Reload |
| **1 / 2 / 3** | Switch between rifle / shotgun / sniper |

## Project layout

```
pubg.html          entry point (HUD markup + script includes)
css/style.css      HUD, menus, kill feed, health bar styling
js/utils.js        math helpers + seeded simplex noise
js/scene.js        renderer, camera, gradient sky dome, sun + fill lights
js/terrain.js      village/road layout, noise heightfield, vertex-colored terrain chunks
js/world.js        water, mountains, clouds, trees/rocks/grass, buildings + colliders
js/combat.js       hitscan raycasting, weapon stats, loot crates
js/effects.js      particle pools, bullet tracers, impact FX
js/player.js       player state, gun viewmodels, shooting, input, movement
js/bots.js         humanoid bots — AI, walk animation, ragdolls, damage + kills
js/game.js         shrinking zone, minimap, HUD updates, match flow, main loop
```

The scripts are classic (non-module) and load in dependency order, so the game runs directly from `file://`.

## Features

- Procedural terrain colored by height and slope — grass, dirt, rock, sand beaches — with dirt roads connecting a village
- Real-time PCFSoft shadows, hemisphere + ambient fill, distance fog matched to the sky
- Three weapons with distinct viewmodels, recoil, muzzle flash, tracers and hit sparks; right-click aiming with a scoped sniper view
- 15 bots that roam, chase, take cover, fight each other, and ragdoll on death
- Shrinking zone wall, loot crates, medkits, kill feed, minimap, victory & death screens
