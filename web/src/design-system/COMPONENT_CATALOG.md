# LexGraph Component Catalog

## Foundation

- `Button`: primary action control with outline, ghost, and destructive variants.
- `ThemeToggle`: cycles between light, dark, and system themes.
- `Skeleton`: lightweight loading placeholder for panels and graph states.
- `Drawer`: bottom-sheet presentation for mobile workspace panels.
- `Toast`: ephemeral notification surface for copy, export, and status feedback.

## Workspace Surfaces

- `WorkspaceSearch`: persistent search input for homepage and workspace entry.
- `WorkspaceGraphControls`: graph actions for zoom, fit, download, and link copy.
- `WorkspaceFilters`: relationship toggles that mirror graph state.
- `InspectorPanel`: reading-focused detail surface for the selected node.

## Graph Styling Rules

- Use semantic tokens for graph background, node fill, edge color, and family colors.
- Keep the graph visually dominant; panels should stay visually quieter than the canvas.
- Prefer soft borders, subtle shadows, and restrained motion.

## Accessibility Rules

- Every actionable control must have a visible focus state.
- Mobile controls should remain at least 44px high or wide.
- Empty and error states must explain what happened and the next action.