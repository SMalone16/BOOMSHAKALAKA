# BOOMSHAKALAKA! 🏀
**2-on-2 arcade basketball** with original pixel-art characters, seven theme teams, stat-radar scouting cards and 1–4 browser players. Built from the ideas in the original Canva Code "Full Court Frenzy" experiment, but re-engineered for a Node.js-authoritative multiplayer game.

## Play in a GitHub Codespace
1. Open this repository → **Code → Codespaces → Create codespace** (select the multiplayer feature branch until merged).
2. Wait for the devcontainer setup to install Node packages.
3. In the Codespace terminal, run \`npm start\`.
4. In **Ports**, find port **3000**. To share the hosted game with other computers, change its visibility to **Public** and use **Open in Browser**. Don't make other Codespace ports public.
5. Choose **1 PLAYER · VS CPU** or **HOST MULTIPLAYER**.
6. For multiplayer, copy the generated share link; each person opens it and enters unique 3-letter initials. The host chooses **random teams** or **host assigns**. The draft begins when the host starts it, or after all four players enter initials.
7. Each side's captain chooses the team's theme. Each player selects an athlete; a solo-side player selects both their athlete and CPU teammate. Everyone presses **Ready** to tip off.

**Your Codespace must remain running for multiplayer.** Rooms are in memory (not stored in a database), so closing/restarting the Codespace discards them. Guests cannot open a Codespace link unless the port is reachable and their school's filtering allows the domain.

## Controls
| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| J hold, then release | Shoot / dunk near rim |
| K | Pass if holding ball; steal when defending |
| I | Jump / block |
| L | Sprint (uses stamina) |
| Q | Switch between your two athletes when you are the only human on that side |

On phones or tablets, touch buttons appear under the court. Mouse/touch also support all menu interactions.

## Game modes
- **1 human:** Human + CPU vs two CPU opponents.
- **2 humans:** 1v1 human-controlled athletes; both sides have a CPU partner.
- **3 humans:** A side with two humans faces a human with a CPU partner.
- **4 humans:** 2 humans on each side.
- Remaining court positions are filled by CPU. A single human may switch athletes with Q.
- Host and team captains control lobby/draft progression. Each side's team choice remains hidden from opponents before tip-off.

## Architecture
- \`server/index.js\`: static HTTP files, lobby management, session tokens, WebSocket events, matchmaking and 30 Hz server loop / 15 Hz snapshots.
- \`server/game.js\`: server-controlled movement, passes, shooting, shot/rebound clocks, blocks, dunks, 4 x 60-second quarters and sudden-death overtime.
- \`server/roster.js\`: all seven four-player lineups and balanced attribute values.
- \`public/ui.js\`: lobby, private drafting, team portraits, player picker, radial six-axis scouting chart, keyboard and touch.
- \`public/arena.js\`: procedural character animations, crowd, hardwood court, ball, hoop, scoreboard and audio.
- \`tests/game.test.js\`: game mechanics regression tests.

## Six attributes
Every athlete has values for **Speed, 3PT Shooting, Dunking, Block/Rebound ability, Steals, and Passing**. Higher dunk and block ratings influence interior finishing and recovery. Three-point ratings influence deep shooting, passing ratings help ball protection, and stamina governs sustained sprinting.

## Art and IP
Current stadium, avatars, character silhouettes and animations are **original code-drawn pixel art** with no external sprite dependencies. Character appearances are original rather than copied from any Pokémon or NBA property, even when users have chosen names that allude to them. For a later licensed art upgrade, [Kenney's Sports Pack](https://kenney.nl/assets/sports-pack) has CC0 assets; verify suitability and retain licensing information before distributing. No external images are currently bundled.

## Development
\`\`\`bash
npm install
npm test
npm start
\`\`\`
Then open http://localhost:3000. GET \`/health\` returns server status.

## Safety and limitations
Educational prototype, **not a production-scale public game service**: rooms have unguessable temporary codes and per-player session tokens, but no accounts, persistent game storage, matchmaking service, moderation, or anti-cheat telemetry. The server accepts only predefined control buttons, limits message size and rate, and controls authoritative scores/movement. Codespaces is suitable for supervised playtesting; do not keep its public port running unattended. If a player leaves mid-game, their athlete falls back to AI until they reconnect.

## New Pallet + Pewter character art (sprite runtime)
**Eight custom sprite sheets are now integrated.** The game uses the filenames already uploaded in \`public/assets/sprites/pallet/\` and \`public/assets/sprites/pewter/\`. No renaming is needed.

- Pallet: \`Pallet - Ash.png\`, \`Pallet - Gary.png\`, \`Pallet - Professor.png\`, \`Pallet - Leaf.png\`
- Pewter: \`Pewter - Brock.png\`, \`Pewter - Flint.png\`, \`Pewter - Opal.png\`, \`Pewter - Boulder.png\`
- Each PNG is 1086 × 1448 RGBA. \`public/sprites.js\` extracts a **3×3 grid** and displays each cell at a logical 48 × 64 pixel resolution with nearest-neighbor scaling.
- Frame order: **idle**, **running A**, **running B**, **dribble**, **pass**, **shoot**, **block/jump**, **dunk**, **celebrate**. Running alternates the two available poses; the others are key poses, not yet full multipose animation sequences.
- Server snapshots contain a persistent \`profileId\`, so sprite selection always follows the athlete you picked even if their in-game court slot changes.
- The **team draft portraits** and **live match characters** both use these sprite sheets. If an asset is missing, slow to load, or the opponent belongs to an unfinished team, the original procedural character artwork remains in place.
- The basketball, scoreboard, shot meter, and player selection ring are still rendered by the existing game code.

### Preview and troubleshoot
While the Codespace is running, open **\`/sprite-lab.html\`** on the same forwarded game URL. Pick a character to see the original sheet and the exact nine cropped frames the game uses. Adjust the temporary inset, margin, or gap controls to test cropping. These changes affect only the diagnostic preview; once the values look correct they can be configured in \`public/sprites.js\`.

The source PNG having an RGBA channel **does not prove its background is transparent**. Sprite Lab reports an approximate transparent-pixel percentage; if it says 0% fully transparent and you see a visible background in every frame, remove the original backgrounds and replace those PNGs in GitHub.

### Adding the remaining five teams
Add four equally organized PNGs to each team's folder. Then append the corresponding character roster IDs and exact filenames to the \`characters\` map in \`public/sprites.js\`. This does not require changes to multiplayer or the basketball physics.

## Ash and Leaf: eight-direction animation test

Ash and Leaf have **new 10×8 sprite atlases** alongside their original 3×3 sheets.
The uploaded names are **\`public/assets/sprites/pallet/ash.png.png\`** and **\`public/assets/sprites/pallet/leaf.png.png\`** (two .png suffixes); the engine uses them as-is.

- 8 sprite rows, in clockwise order: **N, NE, E, SE, S, SW, W, NW**. The server broadcasts \`facing8\` with each player (including CPU opponents) based on movement inputs, and fixes pass facing toward the teammate until the pass action ends.
- 10 pose columns in order: **Idle A, Idle B, Run A, Run B, Run C, Run D, Dribble A, Dribble B, Pass Windup, Pass Release**.
- The client advances run poses every 115 ms, dribble every 160 ms, idle every 550 ms; passing plays windup then release and holds the second pose while the pass action continues. Client-side animation clocks interpolate between 15 Hz multiplayer snapshots.
- **Only Ash and Leaf** use these directional sheets. For **shoot, jump/block, dunk, and celebrate**, both retain their old 3×3 art until the new action frames are drawn. Gary, Professor, Pewter and the remaining teams work as before.
- Sprites are sliced from the original uploaded PNGs directly using exact fractional cell boundaries. The display preserves cell aspect ratio and uses nearest-neighbor rendering; no need to manually resize your art or rename the uploaded files.
- The ball, physics, possession, network synchronization and other gameplay rules are unchanged.

### Directional sprite diagnostics
Open **\`/directional-lab.html\`** on the Codespaces forwarded game URL. Choose Ash or Leaf; select one of the eight facings; then preview Idle, Run, Dribble or Pass in motion. You can also view the raw uploaded sheet and the ten extracted source frames for that direction. Use **\`/sprite-lab.html\`** to inspect the old nine-pose fallback sheets.

This is a first-pass atlas integration, **not an asset-pipeline retouch**. It assumes the new sheets really use a 10×8 equal-cell grid. If art in any frame is off-center or crosses cell boundaries, please flag which athlete, direction and animation in the preview and we can add calibrated per-image trimming/anchor points without changing the server.
