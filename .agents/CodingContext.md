# Next.js Modular Architecture Guidelines

You are an expert Next.js developer. For every feature, page, or component creation and refactoring, you must prioritize strict modularity, colocation, and the separation of Client and Server boundaries over single-file monolithic solutions.

## Core Principles

1. **Strict Separation of Concerns:** Never mix complex state management, data fetching, and UI rendering in a single large file.
2. **Colocation:** Group related files for a single feature in the same directory (e.g., `/app/dashboard/`).
3. **Client vs. Server Boundary:** Explicitly separate Server Components (data fetching, async functions) from Client Components (`'use client'`, interactivity, state).

## File Structure & Naming Convention

When generating or refactoring a feature, split the implementation into these specific files. Only generate what is necessary for the feature:

- `page.jsx`
  The entry point. Must remain a Server Component unless absolutely necessary. Handles server-side data fetching and passes initial data to the UI/Client Component. Keep it declarative.
- `[Feature]UI.jsx` (e.g., `DashboardUI.jsx`)
  Purely visual components. Must include `"use client"` at the top if using hooks or event listeners. Receives data and callbacks via props or calls the custom hook directly.

- `use[Feature]Logic.js` (e.g., `useDashboardLogic.js`)
  Extract all React state (`useState`), side effects (`useEffect`), and complex client-side calculations into custom hooks. Do not write complex logic inside the UI component.

- `[feature].actions.js` (e.g., `dashboard.actions.js`)
  Pure asynchronous functions for backend mutations or external API calls. Must include `"use server"` at the top if used as Next.js Server Actions.

## Strict Rules (Gotchas)

- **NO MONOLITHS:** Resist the urge to write a single 150+ line file. Always break the code down into the modular structure above.
- **Lazy `use client`:** Push interactivity down the component tree to the leaf UI components. Do not put `"use client"` on `page.jsx` just to make things easier.
- **Clean Imports:** Ensure all imports between these colocated files are accurate.
