# DevBuddy English — Development Specification

## Objective
A local-first voice English coach for Brazilian technology professionals. Validate natural conversation, contextual corrections and selectable personalities.

## User journey
1. Select self-assessed English level, scenario, explanation language and personality.
2. Start a voice session and grant microphone access.
3. Speak, see available transcripts, mute or interrupt naturally.
4. End the session.

## Architecture
- Node.js + Express serves the static client and creates short-lived Realtime client credentials.
- Browser uses WebRTC for the live voice connection.
- Permanent API key is read only by the server from `.env`.
- The local server binds to `127.0.0.1`.

## Scenarios and personas
Scenarios: workplace small talk, explaining APIs, AWS/cloud engineering, technical meetings and interviews.
Personas: Friendly, Direct and Tough. Tough mode may joke about mistakes but must not humiliate the learner.

## Out of scope
Accounts, database persistence, billing/subscriptions, certified proficiency scoring, phoneme-level scoring, mobile app and production deployment.

## Acceptance criteria
- App starts after `npm install` and `.env` configuration.
- API key is never exposed in static frontend source.
- Browser can obtain a short-lived client credential from the backend.
- WebRTC voice session starts with microphone permission.
- UI displays transcripts, connection state, timer, mute and end controls.

## Security and limitations
This is a local prototype. Before serving other users, add authentication, rate limits, usage/cost limits, privacy controls and deployment hardening. Audio is sent to the configured AI provider during live sessions. Do not commit `.env`.
