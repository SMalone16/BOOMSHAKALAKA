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
