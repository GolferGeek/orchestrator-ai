# Product Requirements Document (PRD): AI Agent Voice Features

---

## 1. Overview

This document defines the requirements for integrating robust, user-friendly text-to-voice (TTS) and voice-to-text (STT) features into our AI agent-powered web/mobile app. The goal is to provide a seamless, "middle ground" experience: good accuracy, reasonable speed, affordable cost, and broad compatibility, with all fallback and error handling automated for the user.

---

## 2. User Stories

- As a user, I want to dictate messages by clicking a mic icon, with a clear visual indicator that the app is listening.
- As a user, I want to highlight any text and have it read aloud via a right-click context menu.
- As a user, I want the agent to handle all technical details (fallbacks, errors) so the experience is smooth and reliable.
- As a user, I want to be able to use voice features on both web and mobile.
- (Stretch) As a user, I want to trigger voice features using natural language commands in chat (e.g., "Please listen now," "Read aloud your last response").

---

## 3. Requirements

### A. Text-to-Voice (TTS)
- **Primary:** Use **Web Speech API** for reading text aloud.
- **Fallback:** Use **Unreal Speech API** for higher quality or unsupported browsers.
- **User Triggers:**
  - Highlight text and select "Read Aloud" from a right-click context menu.
  - (Optionally) Click a "read aloud" button on chat messages or other UI elements.
- **UX:** Playback should be instant and seamless, with clear feedback that audio is playing.

### B. Voice-to-Text (STT)
- **Primary:** Use **Web Speech API** for transcribing speech to text.
- **Fallback:** Use **Deepgram API** if:
  - The browser API is unsupported, errors, or returns empty/obviously bad results.
  - The browser API returns a confidence score below a reasonable threshold (e.g., 0.7), and the score is trustworthy.
  - The browser API returns a "suspicious" confidence value (e.g., always 0.5 or 1.0), treat as "no confidence" and only fallback on errors or empty results.
- **User Triggers:**
  - Click a mic icon next to the chat bar to start/stop voice input.
  - Show a sound wave or similar animation to indicate listening.
- **UX:** Transcribed text should appear in the chat bar automatically after speaking.

### C. Agent Logic
- The agent is responsible for:
  - Managing all TTS/STT operations, including fallback and error handling.
  - Responding to user-initiated events (button presses, context menu, or commands).
  - Ensuring the user experience is seamless and context-appropriate (e.g., displaying transcribed text, playing audio).
  - Informing users if/when audio is sent to a cloud service.
  - Storing API keys securely (never in frontend code).
  - Logging fallback frequency and confidence score patterns for future tuning.

### D. Platform Support
- All features must work on both web and mobile (Ionic/Capacitor).

---

## 4. Stretch Goals & Future Improvements
*(Not for initial task generation; for future reference only)*

- Natural language command triggers in chat for TTS/STT (e.g., "Please listen now," "Read aloud your last response").
- More advanced context-aware or multi-agent triggers.
- User feedback loop for improving transcription accuracy ("That's not what I said" → auto-retry with fallback or alternate API).
- Support for multiple languages and accents.
- Allow users to select from a variety of voices (including premium/AI voices).
- Advanced error correction or post-processing (e.g., grammar correction, intent detection).
- Support for voice commands (e.g., "Send message," "Read message").
- Analytics dashboard for voice feature usage and fallback rates.
- Accessibility enhancements (e.g., screen reader integration, ARIA labels).
- Integration with Wispr Flow or similar if a public API becomes available.
- **AI-Recommended Additional Stretch Goals:**
  - Voice Activity Detection (auto-detect when user starts/stops speaking).
  - Speaker Diarization (distinguish between multiple speakers).
  - Customizable Hotwords (trigger listening with a phrase).
  - Audio File Upload for transcription.
  - Transcription History (view/search/manage past transcriptions).
  - Playback Speed Control for TTS.
  - Export/Share Audio.
  - Privacy Modes (local/cloud/hybrid processing).
  - Integration with Calendar/Reminders via voice.
  - Voice Biometrics for authentication/personalization.

---

## 5. Decision Rationale & API Comparison

### Why These APIs?

#### Text-to-Voice (TTS)
- **Web Speech API:**  Free, built into all major browsers, instant playback, no server costs. Good enough for most users, with reasonable voice quality and speed.
- **Unreal Speech API (Fallback):**  Very affordable ($0.17 per 1M characters), good quality, easy to integrate. Used only if browser-native TTS is unavailable or unsatisfactory.

#### Voice-to-Text (STT)
- **Web Speech API:**  Free, built into browsers, instant, no server costs. Confidence score available (though not always reliable), good for basic use.
- **Deepgram API (Fallback):**  Excellent balance of price, speed, and accuracy ($0.46/hr of audio). Reliable confidence scores, robust fallback for browsers/devices where Web Speech API is lacking.

### API Comparison Table

| API                | Type   | Price                | Speed      | Accuracy   | Confidence Score | Notes/Tradeoffs                        |
|--------------------|--------|----------------------|------------|------------|-----------------|----------------------------------------|
| Web Speech API     | TTS/STT| Free                 | Instant    | Good*      | Yes (STT)       | Browser support varies, no server cost |
| Unreal Speech      | TTS    | $0.17/1M chars       | Fast       | Good       | N/A             | Cheap, good fallback                   |
| Google Cloud TTS   | TTS    | $4/1M chars          | Fast       | Very Good  | N/A             | More expensive, more voices            |
| Deepgram           | STT    | $0.46/hr audio       | Fast       | Very Good  | Yes             | Best fallback for "middle ground"      |
| OpenAI Whisper API | STT    | $0.36/hr audio       | Medium     | Excellent  | No              | No confidence score, slower            |
| AssemblyAI         | STT    | $0.65/hr audio       | Fast       | Very Good  | Yes             | More expensive, good fallback          |

*Web Speech API accuracy varies by browser and device.

### Alternatives Considered

- **Google Cloud TTS:** More expensive than Unreal Speech, but more voices and higher quality. Use if you need more variety or premium voices.
- **OpenAI Whisper API:** Slightly cheaper than Deepgram, but no confidence score and slower. Use if you need best-in-class accuracy and can tolerate latency.
- **AssemblyAI:** Good fallback, but more expensive than Deepgram for similar quality.
- **Wispr Flow:** No public API as of now, but could be considered if available in the future.

### Summary of Key Tradeoffs

- **Middle Ground Philosophy:**  Chosen to avoid any major weaknesses—prioritizing "good enough" across accuracy, speed, cost, and compatibility, rather than over-optimizing for a single metric.
- **Hybrid/Fallback Approach:**  Browser-native APIs are used for cost/privacy, with automated fallback to cloud APIs for reliability and quality. This ensures the best experience for most users, with no manual intervention required.
- **Confidence Score Handling:**  Confidence thresholding is used for fallback, but "suspicious" or untrustworthy values are detected and handled to avoid false positives/negatives.
- **User-Driven, Agent-Enabled:**  All voice features are user-initiated (via UI or commands); the agent manages the technical details and ensures a seamless experience.
- **Privacy & Security:**  Users are informed if/when their audio is sent to a cloud service. API keys are stored securely and never exposed in frontend code.
- **Stretch Goals:**  Stretch goals are separated from the main PRD to avoid scope creep and ensure a focused, achievable MVP, but are documented for future planning and innovation. 