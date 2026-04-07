# The Quisling Rulebook

Version: `v1 digital build`
Status: `locked scope for the next 1 day of development`

## 1. Core Pitch

The Quisling is a fast, mobile-friendly social deduction heist game for `exactly 5 players`.

Four players are loyal Crew. One player is the hidden Quisling.

The Crew must complete high-risk heists against a corrupt regime. The Quisling must quietly get onto operations and sabotage them without being exposed. The app provides the game state, private role information, hidden mission choices, and public voting. Player discussion happens out loud in person or over an external voice call.

This version is intentionally simple:

- One hidden traitor
- No player elimination
- No role soup
- No special powers
- One clear public loop: `plan -> vote -> heist -> reveal -> accuse`

That keeps the game tense, readable on a phone, and realistic to implement in one day.

## 2. Design Goals

This rule set is locked around four goals:

1. `Simple`: a new player should understand the game in under 2 minutes.
2. `High stakes`: every failed operation matters immediately.
3. `Social`: players should argue about trust, not about complicated exceptions.
4. `Buildable`: every rule below can be implemented in this web app within one day.

## 3. Supported Format

- Players: `5 only`
- Length: `10-15 minutes`
- Devices: `1 phone browser per player`
- Network model: `shared room code`
- Discussion: `outside the app`

Why exactly 5 players for v1:

- Social deduction games like The Resistance, Avalon, and Secret Hitler are built around `5+` players.
- One hidden Quisling is cleanest and most tense at `5`.
- Locking to one count removes balancing holes and speeds up implementation.

## 4. Roles

There are only two roles in v1.

### Crew

- Count: `4`
- Goal: complete enough heists and then correctly identify the Quisling.
- Heist action: may only submit `Clean`.

### Quisling

- Count: `1`
- Goal: trigger enough Alarm or survive the final accusation.
- Heist action: may submit either `Clean` or `Sabotage`.

Important:

- Only the Quisling knows their identity.
- No one starts with extra information.
- There are no extra powers, night phases, or special exceptions in v1.

## 5. Win Conditions

### Crew wins if:

1. The Crew completes `3 successful heists`, and
2. The players correctly detain the Quisling in the final accusation.

### Quisling wins if:

1. The Alarm reaches `3`, or
2. The Crew completes `3 heists` but fails to detain the Quisling in the final accusation.

This means the Crew does **not** win immediately at 3 successful heists. They still have to identify the traitor.

## 6. Public Tracks

The app must display these public values at all times:

- `Successes`: starts at `0`, Crew wins the heist race at `3`
- `Alarm`: starts at `0`, Quisling wins at `3`
- `Rejected Plans`: starts at `0`, resets after any resolved heist
- `Operation Number`: `1` through `5`
- `Current Leader`
- `Current Target Building`
- `Current Team`

## 7. Buildings

The map is not just decoration. Each heist targets one building.

Rules for buildings:

- The game uses the existing map buildings.
- Each operation targets exactly `one` building.
- A building may only be targeted `once per game`.
- Once a building is used, it becomes `locked` for the rest of the match whether the operation succeeded or failed.

Why this rule exists:

- It makes the map matter.
- It prevents repetitive play.
- It is easy to show visually on mobile.
- It is trivial to store as `available` or `spent`.

## 8. Setup

1. Exactly `5` players join a room.
2. The app randomly assigns:
   - `4 Crew`
   - `1 Quisling`
3. Each player privately sees only their own role.
4. The app randomly picks the first Leader.
5. Set:
   - `Successes = 0`
   - `Alarm = 0`
   - `Rejected Plans = 0`
   - `Operation Number = 1`
6. The first unused building is chosen during the first planning phase.

## 9. Operation Sizes

Operation team sizes are fixed by operation number.

| Operation | Team Size |
| --- | --- |
| 1 | 2 |
| 2 | 3 |
| 3 | 2 |
| 4 | 3 |
| 5 | 3 |

These sizes are intentionally borrowed from proven 5-player hidden-traitor team games because they create repeated trust tests without adding complexity.

## 10. Round Structure

Each operation follows the same structure.

### Phase 1: Pick a Target

The current Leader chooses one unused building.

Rules:

- The building becomes the `target` for the current operation.
- Once chosen for the operation, the target building does not change unless the operation ends.

### Phase 2: Propose a Team

The current Leader chooses exactly the required number of players for that operation.

Rules:

- The Leader may include themselves.
- Any player may be selected.
- There are no term limits in v1.

### Phase 3: Vote on the Plan

All 5 players vote `Approve` or `Reject`.

Rules:

- Votes are revealed publicly and simultaneously.
- `3 or more Approve` means the plan passes.
- `2-3` or any tie/failed majority means the plan fails.

If the plan passes:

- Continue to the heist phase.

If the plan fails:

- Increase `Rejected Plans` by `1`.
- Leadership passes clockwise to the next player.
- The target building stays the same.
- The new Leader proposes a new team for the same operation.

### Phase 4: Forced Escalation on 3 Rejections

If `3` plans in a row are rejected for the same operation:

- The target building is lost.
- Increase `Alarm` by `1`.
- Mark the building as `spent`.
- Reset `Rejected Plans` to `0`.
- Leadership passes clockwise.
- Start the next operation.

Theme:

- The window closed.
- Security tightened.
- The Crew wasted too much time.

This rule exists to stop stalling and to create real pressure during public votes.

### Phase 5: Run the Heist

Only players on the approved team act.

Each selected player secretly submits a card in the app:

- Crew may only choose `Clean`
- Quisling may choose `Clean` or `Sabotage`

Important:

- These choices are hidden.
- The app reveals only the final outcome, never who submitted what.

### Phase 6: Reveal the Outcome

Resolve the operation immediately.

If every submitted card is `Clean`:

- Increase `Successes` by `1`
- Mark the building as `spent`
- Reset `Rejected Plans` to `0`
- Pass leadership clockwise
- Start the next operation

If any submitted card is `Sabotage`:

- Increase `Alarm` by `1`
- Mark the building as `spent`
- Reset `Rejected Plans` to `0`
- Pass leadership clockwise
- Start the next operation

Because there is only one Quisling in v1, every failed heist proves the Quisling was on that team.

## 11. Endgame

### If Alarm reaches 3

The Quisling wins immediately.

### If Successes reaches 3

The game enters `Final Accusation`.

This is mandatory. The Crew has succeeded at the heists, but must still identify the traitor.

## 12. Final Accusation

All players secretly vote for the player they want to detain.

Rules:

- Every player votes, including the Quisling.
- Votes are revealed together.
- The player with the `most` votes is detained.
- If the detained player is the Quisling, the Crew wins.
- If the detained player is Crew, the Quisling wins.
- If there is a tie for most votes, the Quisling wins.

Tie rule rationale:

- It keeps the ending sharp.
- It prevents awkward runoff logic.
- It preserves the “high stakes” feel.

## 13. Information Rules

Public information:

- Who the Leader is
- Which building is targeted
- Which players are on the proposed team
- Every Approve/Reject vote
- Success count
- Alarm count
- Rejected Plan count
- Which buildings are spent
- Final accusation votes

Private information:

- Your own role
- Your own hidden heist submission

Hidden forever unless revealed at game end:

- Who the Quisling is
- Which player submitted sabotage on a failed heist

## 14. Timing Rules for the Digital Build

These are not optional. They close stalling holes and make the app workable on phones.

### Recommended timers

- Target selection: `20s`
- Team proposal: `20s`
- Public vote: `15s`
- Hidden heist submission: `15s`
- Final accusation: `20s`

### Timeout defaults

If the timer expires:

- Missing target selection: leadership passes clockwise and `Rejected Plans +1`; no building is spent
- Missing team proposal after a target is chosen: the current plan fails and `Rejected Plans +1`; the target building stays the same
- Missing public vote: counts as `Reject`
- Missing hidden heist submission: the operation immediately counts as a failed heist; `Alarm +1`, the target building becomes spent, `Rejected Plans` resets to `0`, and the next operation begins
- Missing final accusation vote: counts as abstaining and creates no vote

These defaults are harsh by design. They preserve momentum and keep the game from freezing.

## 15. Mobile Browser Rules

The game must work cleanly on a phone. That means the rulebook assumes:

- Each player has their own screen
- Private information is never shown on a shared screen
- Every hidden action is one tap
- Every public vote is one tap
- The app never depends on typing paragraphs
- The app never depends on in-app voice or text chat

Minimum mobile interaction model:

- `Approve`
- `Reject`
- `Clean`
- `Sabotage`
- `Accuse [player]`

Anything more complex than that is out of scope for v1.

## 16. Why This Rule Set Is Fun

This version uses standard social-deduction pressure points that are already proven to work:

- `Public vote + secret mission result`: creates trust arguments
- `No player elimination`: everyone stays involved
- `Escalation after repeated failed votes`: prevents passive play
- `Final accusation after apparent progress`: creates a dramatic finish
- `Single hidden traitor`: easy to understand immediately

This also gives The Quisling one distinctive hook:

- The heists happen on a visible map, and each building is a one-use target that becomes locked after an attempt

That keeps the game unique without making the rules harder to learn.

## 17. Holes Closed on Purpose

These are the design holes this rulebook intentionally removes.

### Hole: too many roles

Closed by using only `Crew` and `Quisling`.

### Hole: players get knocked out and stop having fun

Closed by having no elimination.

### Hole: one player can stall the whole match

Closed by timers and harsh timeout defaults.

### Hole: endless arguing over failed votes

Closed by `3 rejected plans = Alarm +1`.

### Hole: the Quisling is too easy to catch once 3 heists succeed

Closed by `Final Accusation`.

### Hole: the map is cosmetic only

Closed by making buildings one-use targets.

### Hole: too much implementation risk

Closed by removing:

- special powers
- night actions
- multiple traitors
- variable sabotage thresholds
- item cards
- chat systems
- moderator systems

## 18. One-Day Implementation Scope

This is the maximum safe scope for the next day of work.

### Must build

- Room join with exactly `5` players
- Hidden role assignment
- Persistent turn order and rotating Leader
- Operation number and fixed team sizes
- Building selection from the map
- Building lock/spent state
- Public Approve/Reject voting
- Secret heist submission
- Success and Alarm tracks
- Rejected Plan track
- Final accusation vote
- Endgame and result screen

### Nice to have, only if core is done

- Reconnect handling
- Polling updates every few seconds
- Better animations
- Sound effects
- Replay history

### Explicitly out of scope for v1

- Extra roles
- AI players
- In-app chat
- Voice chat
- Real-time freeform discussion tools
- Multiple Quislings
- Role powers tied to buildings
- Cooldowns and resource systems
- Character classes like Engineer/Lookout/Saboteur/Infiltrator

Do not build any of the out-of-scope items before the core loop is complete.

## 19. Suggested Public UI Flow

For implementation, the main phases should be:

1. `Lobby`
2. `Role Reveal`
3. `Pick Building`
4. `Propose Team`
5. `Vote`
6. `Submit Heist Card`
7. `Reveal Outcome`
8. `Final Accusation`
9. `Results`

That state machine is small enough to build fast and test thoroughly.

## 20. Verification Notes

This rulebook intentionally pulls from standard, proven mechanics:

- `The Resistance`: public team selection, hidden sabotage, no player elimination
- `Avalon`: hidden traitor tension and post-mission accusation energy
- `Secret Hitler`: public voting with punishment for repeated failed governments
- `One Night Ultimate Werewolf`: short length, high clarity, no elimination

Why this matters:

- These mechanics are already known to create discussion, bluffing, suspicion, and tension.
- This rulebook keeps those proven mechanics, but trims away the role complexity and long rules overhead.
- The main unique layer is the heist-map theme and one-use building targets.

## 21. Final Lock

This is the version to build.

Do not redesign the game again while implementing unless a true blocker appears.

If a feature is not required by this document, it should not be part of tomorrow’s build.

## Sources

- Secret Hitler official rules PDF: https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf
- Secret Hitler official site: https://www.secrethitler.com/
- The Resistance official page: https://indieboardsandcards.com/our-games/the-resistance/
- The Resistance product page: https://indieboardsandcards.com/product/the-resistance-third-edition/
- The Resistance: Avalon official page: https://indieboardsandcards.com/our-games/the-resistance-avalon/
- Avalon Big Box official page: https://indieboardsandcards.com/our-games/avalon-big-box/
- One Night Ultimate Werewolf official page: https://beziergames.com/collections/all-uw-titles/products/one-night-ultimate-werewolf
