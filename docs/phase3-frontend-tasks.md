# Phase III: Orchestrator-First Frontend - Task Breakdown

This document breaks down the development tasks for building the Phase III orchestrator-first frontend using Ionic and Vue 3, as outlined in the `phase3-frontend-prd.md`.

## 🧱 High-Level Project Setup (Ionic + Vue)

-   [ ] **Task 1.1**: Initialize new Ionic/Vue project (if not already part of the monorepo structure, otherwise integrate into existing `apps/web`).
    -   Confirm build tools (Vite), linter, formatter setup.
    -   Choose Ionic starter template (e.g., blank, sidemenu, tabs - likely `blank` or a simple chat-focused one).
-   [ ] **Task 1.2**: Set up basic project structure.
    -   Create directories for components, views/pages, services, stores (Pinia), assets.
    -   Follow `003-vue-frontend-guidelines`.
-   [ ] **Task 1.3**: Configure Vue Router for basic navigation (e.g., a single chat view).
-   [ ] **Task 1.4**: Set up Pinia for state management.
    -   Create initial store for chat messages and UI state.
-   [ ] **Task 1.5**: Integrate Capacitor into the project for future native builds.
    -   `ionic integrations enable capacitor`
    -   Basic configuration for iOS.

## 💬 Task 2: Orchestrator Chat Interface UI

-   [ ] **Task 2.1**: Develop core `ChatView` page/component.
    -   Use Ionic layout components (`ion-header`, `ion-content`, `ion-footer`).
-   [ ] **Task 2.2**: Create `MessageList` component.
    -   Input: Array of message objects from Pinia store.
    -   Render user messages and agent messages differently.
    -   Style messages for clarity (e.g., alignment, background color).
-   [ ] **Task 2.3**: Create `MessageItem` component.
    -   Input: Single message object.
    -   Display sender (User/Agent Name) and message content.
    -   Implement basic markdown rendering for agent responses (e.g., using a library like `marked` or a Vue equivalent, styled appropriately).
    -   Display timestamp (optional, consider for UX).
-   [ ] **Task 2.4**: Create `ChatInput` component.
    -   Use `ion-input` or `ion-textarea` for text entry.
    -   Include a send button (`ion-button`).
    -   Emit event with message text on send.
-   [ ] **Task 2.5**: Implement state management for messages (Pinia).
    -   Store an array of message objects: `{ id: string, text: string, sender: string, type: 'user' | 'agent', agentName?: string, timestamp: Date }`.
    -   Action to add new user message.
    -   Action to add new agent response.
-   [ ] **Task 2.6**: Connect `ChatInput` to Pinia store to add user messages.
-   [ ] **Task 2.7**: Implement API service for sending messages to the orchestrator.
    -   Create `OrchestratorAPIService.ts` (or similar).
    -   Method `sendMessage(text: string): Promise<AgentResponse>`.
    -   Handle API call to the backend orchestrator endpoint.
-   [ ] **Task 2.8**: Integrate API service with chat view.
    -   On user message send, call API service.
    -   Add agent response to Pinia store.
    -   Handle loading states (e.g., show a spinner while waiting for agent response).
    -   Handle API errors gracefully and display a message to the user.
-   [ ] **Task 2.9**: Ensure responsive design for the chat interface across web and mobile viewport sizes.
    -   Test on various screen dimensions.

## 🎙️ Task 3: Push-to-Talk (PTT) Input

-   [ ] **Task 3.1**: Add PTT button/icon to the `ChatInput` component.
    -   Use an appropriate Ionic icon (`ion-icon`).
-   [ ] **Task 3.2**: Implement browser-based Speech-to-Text (STT).
    -   Use Web Speech API (`SpeechRecognition`).
    -   Handle microphone permissions.
    -   Update input field with transcribed text.
    -   Visual feedback during recording (e.g., button state change, animation).
-   [ ] **Task 3.3 (Stretch/Future)**: Research and prototype Capacitor STT plugin for native mobile.
    -   Identify suitable Capacitor community plugins for STT.
    -   If time permits, implement a basic version for iOS.

## 🤖 Task 4: On-Demand Agent Discovery

-   [ ] **Task 4.1**: Design how agent discovery requests are triggered (e.g., specific user phrases like "list agents").
    -   This logic might reside in the orchestrator backend, but the frontend needs to display the result.
-   [ ] **Task 4.2**: Create a component or modify `MessageItem` to display a list of agents and their descriptions when returned by the orchestrator.
    -   Ensure clean formatting within the chat thread.

## ✨ Task 5: Agent Response Visualization

-   [ ] **Task 5.1**: Ensure `MessageItem` clearly displays the `agentName` when the message `type` is 'agent'.
    -   Example: "Metrics Agent: [response]"
-   [ ] **Task 5.2 (Optional UX Enhancement)**: Design and implement small icons/avatars for different agents.
    -   Store agent icon mappings or derive from agent name.

## 📱 Task 6: Mobile Build Foundation & Testing

-   [ ] **Task 6.1**: Perform initial Ionic/Capacitor build for iOS.
    -   `ionic cap build ios`
    -   Open in Xcode and run on a simulator.
-   [ ] **Task 6.2**: Identify and address any immediate UI/UX issues on the iOS simulator.
    -   Focus on layout, touch targets, and basic navigation.
-   [ ] **Task 6.3**: Document basic steps for building and running on iOS for other developers.

## 🧪 Task 7: Testing & Refinement

-   [ ] **Task 7.1**: Conduct thorough manual testing of all features on web (Chrome, Safari, Firefox).
-   [ ] **Task 7.2**: Conduct manual testing on iOS simulator (and device if available).
-   [ ] **Task 7.3**: Write basic unit tests for critical components or Pinia store logic (as per `003-vue-frontend-guidelines` and `005-testing-standards`).
    -   Example: Test message adding logic in Pinia store.
-   [ ] **Task 7.4**: Code review and refactor based on feedback.
-   [ ] **Task 7.5**: Ensure adherence to all relevant guidelines (Vue, Ionic, project-specific).

## 📝 Task 8: Documentation

-   [ ] **Task 8.1**: Update or create basic README for the frontend app/package.
    -   Include setup, build, and run instructions.
-   [ ] **Task 8.2**: Add comments to complex sections of the code. 