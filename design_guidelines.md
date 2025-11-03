# Bokun API Testing Application - Design Guidelines

## Design Approach

**Selected Approach:** Design System - Technical Dashboard Pattern
**Inspiration:** Linear, Vercel Dashboard, GitHub Actions UI
**Rationale:** This is a utility-focused developer tool requiring clarity, data presentation excellence, and immediate status feedback.

**Core Principles:**
- Information hierarchy through typography and spacing
- Instant visual feedback for API states
- Scannable data presentation
- Professional, technical aesthetic

---

## Typography System

**Font Stack:**
- Primary: 'Inter' via Google Fonts (400, 500, 600)
- Monospace: 'JetBrains Mono' for API responses and code (400, 500)

**Hierarchy:**
- Page Title: text-2xl font-semibold (tracking-tight)
- Section Headers: text-lg font-semibold
- Card Titles: text-base font-medium
- Body Text: text-sm font-normal
- Labels: text-xs font-medium uppercase (tracking-wide)
- Code/JSON: text-xs font-mono
- Status Messages: text-sm font-medium

---

## Layout System

**Spacing Primitives:** Tailwind units 2, 4, 6, 8
- Component padding: p-6
- Card spacing: space-y-4
- Section gaps: gap-6
- Tight spacing: gap-2
- Container padding: px-6 py-8

**Grid Structure:**
- Main container: max-w-7xl mx-auto
- Dashboard grid: grid grid-cols-1 lg:grid-cols-3 gap-6
- Status cards: Flexible grid adapting to content
- Full-width sections for JSON display

**Responsive Breakpoints:**
- Mobile: Single column, full-width cards
- Desktop (lg:): Multi-column dashboard layout

---

## Component Library

### Status Dashboard Header
- Connection status badge (prominent, top-right)
- Page title with subtitle
- Last updated timestamp
- Refresh action button

### Connection Status Card
- Large status indicator (icon + text)
- API endpoint display (monospace)
- Connection details grid (Access Key masked, Response Time)
- Test connection button (primary action)
- Structured as: Icon + Title + Details Grid + Action

### API Credentials Section
- Masked credential inputs (click to reveal)
- Environment variable indicators
- Validation status per credential
- Secure storage notice text
- Layout: 2-column on desktop (Access Key | Secret Key)

### Products Display Card
- Product count header
- Scrollable product list (max-h-96)
- Each product item: Name + ID + Category badge
- Empty state illustration with helpful text
- Fetch products button

### JSON Response Viewer
- Expandable/collapsible sections
- Syntax-highlighted JSON (using pre + code tags)
- Copy to clipboard functionality
- Scroll container with max height
- Toggle between raw/formatted views
- Header: "API Response" + metadata (timestamp, status code)

### Error Display Component
- Alert-style container
- Error icon + error code
- Message text (readable, not technical jargon)
- Expandable details section
- Retry action button
- Use warm tones for warnings, stronger for errors

### Loading States
- Skeleton loaders for data sections
- Spinner for button actions
- Pulse animation for status checking
- Progress indicators for multi-step operations

---

## Page Structure

**Single Page Dashboard Layout:**

1. **Header Section** (sticky, top)
   - App title: "Bokun API Testing Console"
   - Overall connection status badge
   - Layout: flex justify-between items-center

2. **Credentials Panel** (collapsible)
   - API key inputs with visibility toggles
   - Environment variable status
   - Save/Update buttons
   - Padding: p-6, border-b

3. **Main Dashboard Grid** (3-column responsive)
   - Column 1: Connection Status Card + Quick Stats
   - Column 2: Products List Card
   - Column 3: Recent Activity Log

4. **Full-Width Response Section**
   - Tabbed interface: JSON Raw | Formatted | Headers
   - Collapsible by default, expands when data received
   - Fixed max height with internal scroll

5. **Footer Info Bar**
   - API documentation link
   - Support resources
   - Version info

---

## Interaction Patterns

**Button Hierarchy:**
- Primary actions: Solid style (Test Connection, Fetch Products)
- Secondary actions: Outlined style (Refresh, Copy)
- Tertiary actions: Ghost style (Expand/Collapse)

**State Indicators:**
- Success: Use checkmark icons, positive messaging
- Loading: Spinner + disabled states
- Error: Alert icons, error containers
- Idle: Neutral icons, muted styling

**Data Presentation:**
- Tables: Minimal borders, hover row highlighting
- Code blocks: Rounded corners (rounded-lg), monospace font
- Badges: Rounded-full for status, rounded-md for categories
- Cards: Elevated appearance (shadow-sm), rounded-lg

---

## Images

**No Hero Image Required**
This is a technical dashboard - no marketing imagery needed.

**Optional Illustrations:**
- Empty state graphic for "No Products Found" (simple line art)
- Connection success illustration (checkmark with subtle icon)
- Error state illustration (friendly error icon)
Place these centered within their respective card containers.

---

## Accessibility Features

- Clear focus indicators on all interactive elements
- Aria-labels for status indicators and icon buttons
- Keyboard navigation for all actions
- Screen reader announcements for status changes
- High contrast between text and backgrounds
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels explicitly connected to inputs

---

## Technical Specifications

**Card Component Structure:**
```
- Rounded corners: rounded-lg
- Padding: p-6
- Borders: border (subtle)
- Shadow: shadow-sm hover:shadow-md transition
```

**Monospace Code Display:**
```
- Font: font-mono
- Size: text-xs
- Line height: leading-relaxed
- Overflow: overflow-x-auto
- Background: distinct from page background
- Border: border rounded-md
```

**Status Badge Pattern:**
```
- Size: px-3 py-1
- Border radius: rounded-full
- Font: text-xs font-medium
- Include icon + text
```

This design creates a professional, highly functional testing interface that prioritizes clarity and usability for developers validating API connectivity.