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

## Pallet and Pewter custom character animations

The game now automatically loads **all eight custom 7-row × 10-column (70-frame) sprite atlases**, each from a clean PNG filename:

| Team | Athletes and asset paths |
| --- | --- |
| Pallet Paladins | `public/assets/sprites/pallet/ash.png`, `gary.png`, `professor.png`, `leaf.png` |
| Pewter Power | `public/assets/sprites/pewter/brock.png`, `flint.png`, `opal.png`, `boulder.png` |

The originals were moved *without re-encoding or altering image contents*; the old doubled-`.png.png` paths are gone from this branch.

### Sprite grid and animation behavior

The browser slices each PNG as **7 rows × 10 columns** (70 frames). Fractional image dimensions are handled through rounded pixel crop boundaries; the Sharp tool uses the same rectangles. Row order:

- Row 0: N (back)
- Row 1: NE (back-right)
- Row 2: E (right)
- Row 3: SE (front-right)
- Row 4: S (front)
- Row 5: SW (front-left)
- Row 6: NW (back-left)

The game controls all **eight movement directions**. The missing W view mirrors the painted E view.

Columns 0–9: **Idle A, Idle B, Run A, Run B, Run C, Run D, Dribble A, Dribble B, Pass Windup, Pass Release**.

Characters use the proper four-frame run cycles, two-frame idle and dribble cycles, and two-frame directional pass action. Facing data comes from the authoritative multiplayer server. Rendering clocks interpolate animation locally between network updates, and passing stays pointed at the teammate.

**Important art limitation:** the 70-frame atlases do **not** include dedicated shooting, jumping, blocking, dunking, or celebration art. Rather than switching back to low-detail procedural characters (or loading the removed nine-pose files), these states reuse available 70-frame key poses as temporary **direction-aware stand-ins**. Shooting and dunking turn toward the hoop. Dedicated hand-drawn frames for these actions can be added as a future art upgrade; they are not falsely represented as part of the existing 70.

Other teams continue with the original procedurally drawn character renderer until their atlases are added.

### Preview all eight athletes

Run `npm start` and open **`/directional-lab.html`** on your game URL. Select any Pallet or Pewter athlete, all eight facing directions, and idle/run/dribble/pass. The preview also exposes the temporary action stand-ins. It shows the original full source and ten extracted frames for the selected facing direction. Your original sheets are never modified.

### Sharp sprite tooling (optional, dev-only)

```bash
npm install
npm run sprites:check
npm run sprites:slice -- all
# or for one athlete:
npm run sprites:slice -- pewter-0
```

`sprites:check` inspects all **eight** registered atlases for readable PNGs, alpha transparency, missing frames, and pixels reaching cell edges. A touched edge produces a warning rather than deleting artwork; those frames may need manual visual cleanup.

`sprites:slice` exports each individual frame and `atlas.json` under the Git-ignored `build/sprite-frames/<roster-id>/`. It extracts **560 PNGs total** for these eight athletes. GitHub Actions uploads the generated frames as a temporary inspection artifact; **Sharp is not required in the deployed browser**.

### Extending the roster

Place future 7×10 atlases in `public/assets/sprites/<team>/`, then add their exact filename and roster ID to the `directional` map in `public/sprites.js`. This automatically enables character selection previews and animation in solo, 2-, 3-, and 4-player games without changing the multiplayer server or writing separate movement logic.


## Arcade menu redesign

The responsive front end has a new illustrated arena title screen, original SVG crests for all seven teams, real roster-sprite previews for Pallet/Pewter, and a clearer player choice path. Artwork is layered HTML/CSS/SVG rather than a flattened screenshot, so menu actions stay clickable and accessible.

**Single player:** Title → Single Player → pick *your* team and *CPU opponent* independently → select your two athletes (you plus CPU partner) → Tip Off. Solo games no longer require initials or show the multiplayer lobby/code. CPU team choice is applied server-side before the match starts for animation playtesting.

**Multiplayer:** Title → Multiplayer → Host or Join. Host gets one invite URL using the Codespace's actual public address and ?room=CODE, with a Copy Invite Link button. Joining by link enters automatically; typing the eight-digit code remains a fallback. Players set initials, host chooses random or assigned teams, then everyone follows the existing private team/player draft and match flow. The lobby has Exit.

**Teams/players:** Rosters and hexagonal stat chart use authoritative server/roster.js data. SVG badges and taglines are in public/team-brand.js and can be extended without touching basketball physics. Pallet/Pewter cards use actual 7×10 sprite atlases; unfinished teams retain procedural portraits.

**Art assets:** public/assets/ui/arena.svg is a new original vector stadium backdrop matching the neon-pixel-arcade visual language of the concept art. The earlier generated mockups are design references, *not* noninteractive backgrounds.

**Settings/help:** How to Play describes current controls. Sound Settings toggles actual game sound effects, saved locally.

**Test:** In Codespaces, choose the feature/arcade-menu-overhaul branch and run npm install then npm start. To share invites, keep Codespaces running and make port 3000 publicly reachable to trusted testers. Browser visual review is still required; automated tests cover HTML bindings, routes, WebSockets, and sprite assets.

This branch includes PR #5's Pallet/Pewter 70-frame work because that PR was open when the UI branch was created. If PR #5 merges first, the remaining UI diff will become smaller automatically.
