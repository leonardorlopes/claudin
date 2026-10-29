# DevBuddy English

Voice-first English practice for Brazilian technology professionals. This repository contains a local Windows MVP using Node.js, Express, and the OpenAI Realtime API over WebRTC.

## Requirements
- Windows 10/11
- Node.js 22.6+
- An OpenAI API key with API billing/access enabled for the selected Realtime model
- Chrome or Edge with microphone permission

ChatGPT subscription and API usage are billed separately.

## Run locally
1. Copy this repository to your Windows computer.
2. In PowerShell, run `Copy-Item .env.example .env`.
3. Add your key to `.env` as `OPENAI_API_KEY=...`. Never commit `.env`.
4. Run `npm install`.
5. Run `npm run check`.
6. Run `npm start`.
7. Open http://localhost:3000 and allow microphone access.

## MVP features
- Voice conversation over WebRTC.
- Friendly, Direct, and Tough personalities.
- Beginner to advanced self-assessment.
- Scenarios for small talk, APIs, AWS, meetings, and interviews.
- Visible conversation transcripts and session controls.
- Server-side creation of short-lived client credentials.

## Security and limitations
- The permanent API key stays on the server.
- Audio is sent to the configured AI provider during live sessions.
- No database or user accounts in v0.1; session history is only in the current browser tab.
- The selected level is self-assessed, not a certified proficiency score.
- This is a local prototype, not production-ready. Add authentication, rate limits, privacy controls and cost limits before exposing it to other users.

## Documentation
See [docs/DEVELOPMENT_SPEC.md](docs/DEVELOPMENT_SPEC.md).

## Official references
- https://developers.openai.com/api/docs/guides/realtime
- https://developers.openai.com/api/docs/guides/voice-webrtc
