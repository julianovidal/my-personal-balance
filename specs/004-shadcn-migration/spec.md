# Feature Specification: Migrate Frontend to Real shadcn/ui Components

**Feature Branch**: `004-shadcn-migration`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "As an engineer I want the frontend project to instead of using a "shadcn components like UI" use the real shadcn components. I want to replace the components we have to use the real deal. and structure the frontend project to have the UI of shadcn."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace Custom Components with Official shadcn/ui Components (Priority: P1)

As an engineer working on the frontend, I want every UI component that was previously hand-crafted to mimic shadcn/ui to be replaced with the official shadcn/ui component equivalents, so that the codebase benefits from the maintained, accessible, and consistent component library.

**Why this priority**: This is the core scope of the feature. Without this, nothing else in this migration has value. It establishes the foundation that all other stories build on.

**Independent Test**: Can be verified by auditing the component directory and confirming each component that previously mimicked shadcn/ui now references the official shadcn/ui package. The application must render without visual regression.

**Acceptance Scenarios**:

1. **Given** the frontend is running, **When** any page is opened, **Then** all interactive UI elements (buttons, inputs, dialogs, dropdowns, etc.) render using official shadcn/ui components, not custom reimplementations.
2. **Given** a component previously built to mimic shadcn/ui exists in the codebase, **When** reviewing the source, **Then** no hand-crafted clone of that component remains — only the official import is used.
3. **Given** the official shadcn/ui components are in place, **When** the application is used, **Then** accessibility attributes, keyboard navigation, and ARIA roles work correctly for all migrated components.

---

### User Story 2 - Adopt the Official shadcn/ui Project Structure (Priority: P2)

As an engineer, I want the frontend project to follow the canonical shadcn/ui directory and file structure (e.g., `components/ui/` folder with component files generated via the shadcn CLI), so that future engineers can add or update components using standard shadcn/ui conventions without friction.

**Why this priority**: Correct structure ensures the project is maintainable and compatible with the shadcn/ui tooling ecosystem. Without it, component additions would be inconsistent and error-prone.

**Independent Test**: Can be verified by inspecting the project's component directory and confirming it matches the expected shadcn/ui layout. Adding a new component via the standard shadcn/ui workflow should place it in the correct location.

**Acceptance Scenarios**:

1. **Given** the project is structured correctly, **When** a developer looks for UI components, **Then** they are located in the designated shadcn/ui component folder following the expected naming convention.
2. **Given** the canonical structure is in place, **When** a new shadcn/ui component needs to be added in the future, **Then** the process follows the standard shadcn/ui workflow without requiring custom configuration.
3. **Given** the structure has been adopted, **When** reviewing the project, **Then** no duplicate component folders or conflicting UI directories exist.

---

### User Story 3 - Visual Consistency After Migration (Priority: P3)

As an engineer, I want the visual output of the application to remain consistent with the existing design after the migration, so that end users experience no unintended visual regressions.

**Why this priority**: Preserving the user experience during an internal engineering change is important but secondary to completing the migration itself.

**Independent Test**: Can be verified by reviewing each page visually before and after the migration, confirming layout, color, spacing, and component behavior remain equivalent.

**Acceptance Scenarios**:

1. **Given** the migration is complete, **When** each application page is loaded, **Then** the visual appearance matches the pre-migration design to a reasonable degree (same component shapes, spacing, and interaction patterns).
2. **Given** a component's styling slightly differs from the custom clone, **When** an engineer reviews it, **Then** the deviation is intentional and documented rather than an unintended regression.

---

### Edge Cases

- What happens when an existing custom component has behavior not directly supported by the official shadcn/ui counterpart?
- How does the application handle components that were extended or modified beyond what shadcn/ui provides out of the box?
- What if a custom component has no direct shadcn/ui equivalent — should it be removed, kept as-is, or replaced with the closest available match?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend project MUST have the official shadcn/ui component library integrated as a dependency.
- **FR-002**: All previously custom-built UI components that mimic shadcn/ui components MUST be replaced with their official equivalents.
- **FR-003**: The project MUST follow the canonical shadcn/ui directory structure for component organization.
- **FR-004**: All application pages and views MUST continue to function correctly after the migration, with no broken layouts or missing components.
- **FR-005**: The project MUST NOT contain duplicate implementations of the same component (one custom, one official).
- **FR-006**: Engineers MUST be able to add new shadcn/ui components using the standard shadcn/ui workflow without custom workarounds.
- **FR-007**: All migrated components MUST retain accessible behavior (keyboard navigation, ARIA roles) equivalent to or better than the pre-migration state.
- **FR-008**: Upon completion of the component migration, the project constitution MUST be amended to update the technology table entry from "shadcn-style components" to "shadcn/ui components" to formally reflect the official library adoption.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of custom UI components that were cloning shadcn/ui components are removed from the codebase and replaced with official imports.
- **SC-002**: The frontend project directory structure matches the expected shadcn/ui layout, verifiable by a new engineer without prior project knowledge.
- **SC-003**: All application pages load and render without visual regressions, confirmed by page-by-page comparison before and after migration.
- **SC-004**: A new UI component can be added to the project using the standard shadcn/ui workflow in under 5 minutes, with no custom setup required.
- **SC-005**: Zero broken UI interactions (clicks, form submissions, dialogs, dropdowns) exist in the application after migration.

## Clarifications

### Session 2026-04-06

- Q: Should the constitution amendment be a formal deliverable of this feature or just a follow-up recommendation? → A: Formal in-scope deliverable — the constitution must be amended before the branch is considered done.

## Assumptions

- The frontend project currently contains hand-crafted or manually copied components that visually mimic shadcn/ui but are not sourced from the official library.
- The existing application uses a theming approach compatible with shadcn/ui's styling system (CSS variables-based theming).
- Custom component extensions or overrides that go beyond what shadcn/ui provides natively are out of scope and will be handled separately if needed.
- The migration does not require changes to the backend or data layer — it is purely a frontend UI concern.
- All existing pages and features must continue to work after the migration; no features are being added or removed as part of this work.
- The project's existing styling system is compatible with shadcn/ui's theming without a complete design overhaul.
