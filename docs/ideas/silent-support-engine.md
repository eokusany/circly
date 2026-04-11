# Silent Support Engine

## Problem Statement

How might Circly close the gap between "I'm not okay" and "someone noticed" without requiring the person to ask for help?

People who need support most are the least likely to ask. Elders in care homes don't want to be a bother. People in recovery don't want to seem weak. The current model (emergency button, chat, check-ins) still requires the hardest step: deciding to reach out. Circly's differentiator is making silence itself the signal.

## Recommended Direction

Three features working as one system:

### 1. Silent Signal (detection)

Circly watches for absence patterns and behavioral shifts across data the user is already generating: missed check-ins, broken streaks, status shifts (good_day to struggling), chat silence, skipped "I'm okay" taps. When a pattern crosses a configurable threshold, the supporter receives a gentle, non-alarming nudge: "it's been 3 days since mom checked in. maybe reach out?"

The person at the center does nothing. They don't press a button. They don't compose a message. Their silence is heard.

This is not surveillance. Supporters never see raw data unless the person opted in (existing permissions system). They see a nudge to reach out, not a dashboard of metrics. The framing is "your person might need you" not "your person missed 3 check-ins."

### 2. "I'm okay" Loop (input)

A daily nudge sent at a user-configured time: "tap if you're okay." One tap. Done. No status to pick, no note to write, no mood to label. The lowest possible friction for generating a daily presence signal.

If the tap doesn't come by a configurable window (e.g., 2 hours after the nudge), Silent Signal treats it as a missed signal. After N consecutive misses (configurable, default 2), supporters get nudged.

For elders: this is a digital wellness check that feels like a gentle "good morning" not a medical alert. For recovery: it's a daily lifeline that catches silence before crisis.

This also solves the cold-start problem. New users have no check-in history for Silent Signal to analyze. The "I'm okay" loop gives them a signal source from day one with zero learning curve.

### 3. Warm Ping (response)

When a supporter gets a Silent Signal nudge, they need a response that's lighter than a message and warmer than nothing. The Warm Ping is a single tap that sends a gentle haptic buzz + visual glow to the other person's phone. No words. No conversation thread. Just: "someone is thinking of you."

The person at the center sees: "Sarah is with you" with a soft animation. That's it. No reply expected. No "how are you?" to answer. Just presence.

This completes the loop: silence is detected, a supporter is nudged, warmth is sent, and the person at the center feels held without ever having asked.

### Future: Circle Pulse (visualization)

Once the detection engine is mature, the Circly logo itself becomes a living pulse on the supporter's screen. It shifts warmth/intensity based on the person's overall signal health. Cooling pulse = something's different. No data points, no numbers, just a feeling. The brand literally embodies its purpose.

This is deliberately deferred so the logo animation can be designed holistically with the detection data rather than retrofitted.

## Key Assumptions to Validate

- [ ] Elders will tap a daily "I'm okay" prompt consistently enough to make absence meaningful. Test: prototype with 5 elder users for 2 weeks, measure tap rate and drop-off.
- [ ] Supporters experience nudges as helpful, not annoying. Test: A/B test nudge copy and frequency with 10 supporter users. Track whether nudges lead to contact or app uninstalls.
- [ ] "Silence as signal" doesn't create false alarms that erode trust (e.g., phone died, went on vacation). Test: build a configurable grace period and "I'm taking a break" snooze. Measure false-positive rate in beta.
- [ ] Warm Pings feel emotionally meaningful, not gimmicky. Test: user interviews after 1 week of use. Do people describe them as "nice" or "pointless"?
- [ ] The detection thresholds are tuneable enough to work across very different user profiles (a 22-year-old in recovery vs. an 80-year-old in a care home). Test: start with simple rules (N missed days), instrument everything, add intelligence later.

## MVP Scope

### In scope

**Silent Signal (v1 - rule-based):**
- Track last check-in date, last "I'm okay" tap, last message sent per user
- Rule engine: if (days_since_last_signal > user_threshold) then nudge supporters
- Default threshold: 2 days missed. User-configurable (1-7 days).
- Supporter nudge: push notification + in-app notification. Copy: "it's been [N] days since [name] checked in. maybe reach out?"
- Nudge cooldown: max 1 nudge per supporter per person per 48 hours (prevent spam)

**"I'm okay" Loop:**
- New DB table: `okay_taps` (user_id, tapped_at, nudge_sent_at)
- Daily local notification at user-configured time (default 9am local)
- Single-tap response screen: big warm button, one tap dismisses
- "I'm taking a break" snooze (1 day, 3 days, 1 week) to prevent false alarms
- Feeds into Silent Signal as a signal source alongside check-ins and messages

**Warm Ping:**
- New DB table: `warm_pings` (sender_id, recipient_id, created_at)
- Send: one-tap from supporter nudge notification or from the person's card
- Receive: push notification + in-app toast with haptic. "[Name] is with you."
- No reply mechanism. Intentionally one-directional.
- Rate limit: max 3 pings per supporter per person per day

### Out of scope (and why)

- **ML/AI pattern detection** -- rule-based is good enough for v1 and dramatically simpler. Add intelligence once we have real usage data to train on.
- **Circle Pulse visualization** -- needs the detection engine to be stable first, plus dedicated design work to integrate with the logo. Phase 2.
- **Scheduled Presence** -- great retention feature but not the core differentiator. Layer on once circles are active.
- **Story Drops** -- interesting async sharing model but adds complexity to the content model. Revisit after chat (Task 11b) ships.
- **Supporter Burnout Shield** -- matters at scale, not at launch. The nudge cooldown is a lightweight version of this.
- **Configurable detection rules per relationship** -- keep it simple: one threshold per user, applied to all supporters. Per-relationship tuning is a power-user feature for later.
- **SMS/call fallback for nudges** -- push notifications only for MVP. SMS integration is a Phase 2 infrastructure decision.

## Open Questions

- Should the "I'm okay" tap also count as a check-in, or are they separate signals? (Leaning separate: the tap is presence, the check-in is status. Different data, different purpose.)
- What's the right default nudge time for elders vs. recovery users? Should context (recovery vs. family) set different defaults?
- Should supporters see *how many* days it's been, or just "it's been a while"? Specific numbers might feel clinical; vague language might not motivate action.
- Should warm pings be anonymous in group circles ("someone in your circle is thinking of you") or always attributed? Attribution feels warmer but might create guilt if one supporter pings more than others.
