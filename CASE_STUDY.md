# AeroDrift: Case Study

**Tejash Raj** · M.Des, IIT Guwahati · Role: game, UX and visual design, front-end engineering · 2026
**Stack:** React, Three.js, React Three Fiber, Vite, Web Audio API · **Platforms:** desktop and mobile browsers

> Lines marked ✎ are for you to fill in with your own process material (sketches, playtest notes, screenshots). Real artefacts make a case study credible. Don't skip them.

---

## 1. The brief I set myself

Make a 3D action game that anyone can play **from a link, with no install, on whatever device they have**. The design challenge wasn't drawing a nice-looking ocean. It was making a fast, twitchy game feel **fair, readable and comfortable** on both a keyboard and a phone held in two thumbs.

**Who it's for:** people who open a link someone sent them, often on a phone, and will give a game about 30 seconds before deciding whether it's worth their time.

**What success looks like**

1. A first-time player understands the controls and goal before the first enemy arrives.
2. Every hit taken feels like the player's fault, not the game's.
3. The game runs smoothly on a mid-range phone.
4. Sound, motion and controls can be adjusted for comfort and accessibility.

✎ *Add: moodboard / references (arcade shooters, flight HUDs, ocean palettes) and 2–3 early sketches.*

---

## 2. Version 1, and an honest audit

The first version worked: three ships, three times of day, touch controls, music. But when I reviewed it against the goals above, I found problems at every layer.

| Area | What I found in v1 | Why it mattered |
| --- | --- | --- |
| Fairness | Asteroid hitboxes were about **2× the size of the rock** | Players got hit by rocks they had clearly dodged |
| Controls | The KEYBOARD / TOUCH toggle was reset every time a run started | A headline feature didn't work |
| Controls | Touch buttons only listened for "finger up" | Sliding a thumb off a button left the ship firing or turning forever |
| Feedback | Holding fire on an empty laser **stopped it recharging**, with no message | Felt like the gun was broken |
| Feedback | The crosshair sat at screen centre, but shots travelled elsewhere | The aim indicator was lying to the player |
| Flow | No retry button, no high score, no difficulty curve | No reason to play a second run |
| Audio | One `<audio>` element per sound, rewound on every play | Rapid fire cut itself off; pausing restarted the music |
| Performance | Ocean computed on the CPU (16k vertices/frame), ~300 draw calls, ship model re-cloned on every score change | Too heavy for phones |
| Craft | A single 714-line file, inline styles, three different font families | Hard to iterate on, and visually inconsistent |

The audit also showed that my first write-up **overclaimed**. It described a vertex shader, the Web Audio API and modular components that weren't actually in the code. Version 2 builds those things for real, and this document describes only what the code does.

---

## 3. Design decisions

### 3.1 Fairness: forgive the player, reward the player

Arcade games feel fair when the rules lean slightly towards the player. I made this explicit and tunable in `config.js`:

- **Collision radius = 80% of the visible size** (`rammingForgiveness`). Near misses count as misses.
- **Shot radius = 115% of the visible size** (`shotGenerosity`). Near hits count as hits.
- **1.4 s of invulnerability after a hit**, shown by the ship blinking, so one mistake never chains into two.
- **Swept bullet collision.** Each shot is tested as a line segment between frames, so a fast bullet can't pass through a target on a slow device.

### 3.2 A crosshair that tells the truth

The camera sits above and behind the ship, so shots fired straight ahead don't land at screen centre. The crosshair is now **projected from a point 220 units in front of the ship** every frame. Wherever it sits is where your shots will go.

### 3.3 Onboarding in the first 30 seconds

- On the **first launch only**, a three-card "How to play" screen appears, adapted to the current input device: keys on desktop, gestures on touch.
- The first enemies spawn about **4 seconds out**, which gives time to try the controls.
- **Control hints** fade out after 9 seconds and can be turned off in settings.
- A **Recharging** label appears the moment you try to fire on an empty laser. A silent failure became a readable rule.

### 3.4 Reasons to play again

- **Sectors.** Every 30 seconds there are more enemies, faster flight and more saucers, announced with a banner and a chime.
- **Chain multiplier up to ×5**, with a visible draining timer, which rewards aggressive, accurate play.
- **Risk / reward ships.** The fragile Interceptor earns ×1.5 points and the Defender ×1.2. The trade-off is printed on the ship card, not hidden.
- **Game-over screen** with score, a personal-best badge, kills, accuracy, survival time, sector and best chain. One button retries (`R`), one changes ship, one shares the score.
- **Input grace period.** Retry ignores input for 0.8 s after a crash, so a fire button still held from the crash can't skip the results.

### 3.5 Touch controls designed around thumbs

- **Floating analog stick.** It appears wherever the left thumb lands, so there's no fixed target to miss. It supports diagonals and partial deflection, with a dead zone.
- **Pointer capture** on every button guarantees the release is always detected. The stuck-input bug is gone at the root.
- **Layout follows the thumb zones.** Steering is bottom-left, FIRE (96 px) and BOOST (68 px) are bottom-right, ship systems sit bottom-centre between the thumbs, and score and pause sit at the top where thumbs never rest.
- **Automatic mode switching.** Whichever input you used last wins, and you can still force a mode in settings.

✎ *Add: thumb-zone diagram and a photo of playtesting on a real phone.*

### 3.6 A HUD that reads at a glance

- Every HUD cluster sits on a translucent plate. In early tests the labels disappeared against the bright daylight sky.
- Each gauge has a **label and a state colour**: boost turns amber when active and red when locked; the laser turns red while recharging.
- Hull is shown as **discrete pips in the ship's colour**, which are easier to count mid-dodge than a continuous bar.
- At **one hull point left**, a slow red pulse frames the screen.

### 3.7 Visual language

- **Palette:** deep-ocean navy surfaces; **amber** is the only "act now" colour (launch, fire, chain, warnings), like cockpit warning lights; **ice cyan** means energy.
- **Type:** *Chakra Petch* (squared, aerospace) for display and *IBM Plex Mono* with tabular numbers for readouts, so changing scores don't jitter.
- **Enemies are designed to be read instantly.** Rocks are dark with a molten-orange wire glow. Saucers have a cyan dome and an amber ring, and the dome **turns red once damaged**, so "one more hit" needs no UI.

✎ *Add: palette and type specimen board, and enemy design iterations.*

### 3.8 Audio as information

- The music runs through a **low-pass filter driven by game state**: muffled in the hangar, wide open in flight, underwater-dull when paused, slowing down like a tape stop on game over.
- Overlapping sound buffers mean rapid fire **never cuts itself off**. Pitch varies slightly per shot so repetition doesn't grate.
- UI sounds (select, launch, recharge-denied, sector chime) are **synthesised in code**, so they add no download.
- Separate master, music and effects sliders, plus `M` to mute from anywhere.

### 3.9 Accessibility and comfort

- **Reduce motion** follows the OS setting by default. It removes screen shake and camera roll, softens the boost FOV kick and shortens UI animation. Damage feedback is kept, because it's information.
- Separate **screen-shake** toggle, **invert vertical** option and **battery-saver graphics** (lower resolution, no blur effects).
- Full **keyboard navigation**: ARIA radio groups with arrow keys, labelled switches and sliders, dialogs that trap and restore focus, and a visible amber focus ring.
- All touch targets are at least 44 px. The game **auto-pauses** when the tab or window loses focus.

---

## 4. Engineering for feel and performance

| Decision | What it does |
| --- | --- |
| Non-reactive game state | Gameplay writes to plain objects. React handles screens only, so gameplay never causes a re-render. |
| HUD in its own rAF loop | Writes to the DOM directly, and only when a value changes |
| GPU ocean | Waves and their analytic normals are computed in the vertex shader. The plane snaps to its grid as it follows the camera, so the waves never slide. |
| Instancing | Up to 90 enemies in 5 draw calls; lasers, particles and clouds in one each. Roughly 300 draw calls → under 20. |
| Frame-rate independence | All motion uses delta time and exponential damping, so 60 Hz and 144 Hz screens differ by under 0.3%. Large frame gaps are clamped. |
| Adaptive resolution | Drei's `PerformanceMonitor` lowers the pixel ratio if the device can't hold its frame rate |
| Object pools | Enemies, lasers and particles are pre-allocated and recycled, so nothing is allocated during play |
| Web Audio engine | Decoded buffers, gain buses, a state filter, and loop points trimmed past MP3 encoder padding for a gapless loop |
| Safe failure | Missing audio or blocked storage never crash the game. The boot screen has a 9 s fail-safe. |

**Assets:** the soundtrack is a 3:28 track at 32 kbps (~0.8 MB, down from the original 6.5 MB export). The three ship models total ~52 KB.

---

## 5. Testing

**Automated playtest bot** (`npm run playtest`). It runs the real simulation headlessly with a bot pilot, several runs per ship, and prints average survival, score, kills, sector and accuracy. The first run showed the Juggernaut out-scoring the other ships by about 10×. That led to the score multipliers and a one-point hull reduction, which brought the ships within roughly 2–4× of each other with a blind bot. Human players aim, so the final tuning comes from people.

**Human playtests.** ✎ *Fill in after testing with 5–8 people:*

| # | Device | Who | First-30-seconds observations | Issue found | Change made |
| --- | --- | --- | --- | --- | --- |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

Suggested tasks to observe: *start a run without help · find the boost · survive to sector 2 · change a setting*.
Measure: time to first kill, deaths before sector 2, number of "what happened?" moments.

**Performance.** ✎ *Measure on a mid-range Android phone and a laptop (Chrome DevTools → Performance, or the `stats` overlay) and record FPS for High detail and Battery saver.*

---

## 6. Reflection

✎ *Write 4–6 sentences in your own voice. Prompts:*
- What did auditing my own work teach me? (The overclaiming lesson is a strong, honest story.)
- Which design decision made the biggest difference in playtests?
- What would I do next: gamepad support, a global leaderboard, more enemy types, or a proper art pass on the ships?

---

**Links:** ▶ Play · Source on GitHub · Portfolio
