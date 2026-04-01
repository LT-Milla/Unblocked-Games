# 3D City Driving Game

This repo contains a simple 3D driving game built with three.js. The game is designed to run as a self-contained static page that can be embedded into Google Sites using an iframe.

## Files

- `index.html` — main game page
- `style.css` — visual styling and HUD text
- `game.js` — game logic, scene setup, car controls, and animation

## How to preview locally

1. Open `index.html` in a browser with a local static server.
2. If you have Python installed, run:

```bash
cd /workspaces/Unblocked-Games
python3 -m http.server 8000
```

3. Open `http://127.0.0.1:8000` in your browser.

## How to embed in Google Sites

1. Host the page on a public URL.
   - Option 1: Enable GitHub Pages for this repository.
   - Option 2: Use any static web host that serves `index.html`.

2. In Google Sites, choose `Embed` and then `By URL`.
3. Enter the published URL of `index.html`.
4. Resize the embedded frame to show the full game.

## Controls

- Arrow keys or `W` / `A` / `S` / `D` to drive the car.
- Camera follows behind the vehicle.

## Notes

This version uses a simple city grid and smooth driving controls. You can extend it by adding more buildings, traffic, pickups, sound, or collision detection.

