---
name: "Vue Frontend Guidelines"
description: "Best practices for developing the Vue.js frontend application."
globs: ["apps/web/**/*.vue", "apps/web/**/*.js", "apps/web/**/*.ts"]
alwaysApply: true
---

# Vue Frontend Guidelines

## General Principles
- Follow the official Vue.js style guide.
- Write modular, reusable, and maintainable components.
- Prioritize performance and user experience.

## Component Structure
- Use Single File Components (.vue files).
- Organize components into logical directories (e.g., `components/common`, `components/featureX`).
- Keep components small and focused on a single responsibility.
- Use PascalCase or kebab-case for component names, be consistent.

## State Management
- For simple state, use Vue's built-in reactivity system (`ref`, `reactive`).
- For complex global state, use Pinia.
- Organize Pinia stores by feature or domain.
- Avoid direct manipulation of state outside of store actions/mutations.

## UI/UX Patterns
- Strive for a clean, intuitive, and modern user interface.
- Ensure responsiveness across different screen sizes.
- Provide clear feedback to users for actions and loading states.
- Adhere to accessibility best practices (WCAG).

## Asset Organization
- Store static assets (images, fonts) in the `public/` directory or `src/assets/` as appropriate.
- Optimize images for web use.

## Routing
- Use Vue Router for client-side navigation.
- Define routes clearly, potentially in a dedicated `router.js` or `router/index.js` file.
- Use named routes and route parameters where applicable.
- Implement route guards for authentication and authorization.

## API Integration
- Use a dedicated service or utility for API calls (e.g., using `axios` or `fetch`).
- Handle API errors gracefully and provide user feedback.
- Manage loading states effectively.

## Styling
- Prefer scoped CSS within components to avoid style conflicts.
- Consider using a CSS framework (like Tailwind CSS) or preprocessor (like SCSS) consistently.
- Define a consistent design system (colors, typography, spacing).

## Testing
- Write unit tests for components and utility functions using Vitest or Jest.
- Consider end-to-end testing with tools like Cypress or Playwright for critical user flows.
