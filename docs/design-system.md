# LexGraph Design System

## Color Tokens

LexGraph uses semantic tokens for all surfaces, text, borders, shadows, and graph colors.

- `background`, `foreground`
- `card`, `popover`, `muted`, `accent`
- `primary`, `secondary`, `destructive`
- `surface-shell`, `surface-panel`, `surface-card`
- `graph-family-germanic`, `graph-family-romance`, `graph-family-slavic`, `graph-family-semitic`, `graph-family-uralic`, `graph-family-unknown`
- `graph-edge-ancestor`, `graph-edge-descendant`, `graph-edge-borrowing`, `graph-edge-cognate`

## Typography

- Primary: Inter
- Secondary: JetBrains Mono
- Use heading styles for page titles and section labels.
- Use mono sparingly for code, labels, and keyboard hints.

## Spacing And Radius

- Spacing follows an 8px rhythm.
- Radius tokens are used for chips, cards, panels, drawers, and dialogs.
- Avoid arbitrary spacing and hardcoded radii in new components.

## Component Catalog

See [web/src/design-system/COMPONENT_CATALOG.md](../web/src/design-system/COMPONENT_CATALOG.md) for the current reusable component inventory and workspace usage notes.

## Usage Rules

Do:

- Use semantic tokens instead of hardcoded colors.
- Keep the graph visually dominant.
- Prefer lightweight cards and soft borders.
- Use the shared button, drawer, skeleton, and toast primitives.

Don't:

- Introduce page-specific one-off color systems.
- Add heavy borders or decorative chrome to core workspace surfaces.
- Hide loading and error states behind blank space.
- Mix unrelated icon sets or fonts.

## Accessibility

- All interactive controls need visible focus states.
- Mobile touch targets should remain at least 44px.
- Empty and error states should explain the situation and the next action.
- Motion should remain purposeful and respect reduced-motion preferences.
