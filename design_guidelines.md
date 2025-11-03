# Tour Booking Website - Design Guidelines

## Design Approach

**Selected Approach:** Reference-Based - Premium Travel Platform
**Primary References:** Airbnb experiences, Viator, GetYourGuide
**Rationale:** Visual-rich booking experience where tour photography drives engagement and conversion. Clean, spacious aesthetic builds trust and showcases destinations.

**Core Principles:**
- Photography-first presentation with generous breathing room
- Effortless browsing and booking flow
- Trust-building through clarity and professionalism
- Scannable tour information hierarchy

---

## Typography System

**Font Stack:**
- Primary: 'Inter' via Google Fonts (400, 500, 600)
- All text uses Inter - no secondary fonts needed

**Hierarchy:**
- Hero Headline: text-5xl md:text-6xl font-semibold (tracking-tight, leading-tight)
- Page Titles: text-4xl font-semibold
- Section Headers: text-2xl md:text-3xl font-semibold
- Tour Card Titles: text-xl font-semibold
- Subheadings: text-lg font-medium
- Body Text: text-base font-normal (leading-relaxed)
- Price Display: text-2xl font-semibold
- Labels/Meta: text-sm font-medium
- Captions: text-sm (muted styling)

---

## Layout System

**Spacing Primitives:** Tailwind units 4, 6, 8, 12, 16, 24
- Section padding: py-16 md:py-24
- Container padding: px-6 md:px-8
- Card internal: p-6
- Component gaps: gap-8 to gap-12
- Tight spacing: gap-4
- Generous margins between major sections

**Grid Structure:**
- Container: max-w-7xl mx-auto
- Tour Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
- Feature Grid: grid grid-cols-1 md:grid-cols-2 gap-12
- Single column content: max-w-4xl mx-auto

**Vertical Rhythm:**
- Hero section: min-h-screen or 85vh
- Content sections: Natural height with py-16 md:py-24
- Footer: py-12

---

## Component Library

### Navigation Bar
- Fixed/sticky position with subtle backdrop blur
- Logo left, navigation center, CTA right
- Links: text-base font-medium with spacing-x-8
- Mobile: Hamburger menu, slide-in panel
- Height: h-20, minimal borders

### Hero Section
- Full-width immersive tour photography
- Centered headline + subheadline overlay
- Search/filter bar (destination, dates, guests) centered below headline
- Gradient overlay for text readability
- CTA buttons with blurred background treatment
- Minimum height: 85vh, responsive to viewport

### Tour Card Component
- Aspect ratio 4:3 image with rounded-xl corners
- Image fills card top, content below with p-6
- Tour title (text-xl font-semibold)
- Location + duration row (icons + text-sm)
- Short description (2 lines, text-ellipsis)
- Rating stars + review count
- Price prominence: "From £XXX" (text-2xl font-semibold)
- Hover: Subtle lift (shadow transition)
- CTA: "View Details" button

### Tour Detail Section
- Two-column layout (lg:): Gallery left (60%), Details right (40%)
- Gallery: Large primary image + thumbnail grid
- Details panel: Sticky positioning
  - Title, location, rating
  - Key highlights (bulleted, icon-enhanced)
  - Price breakdown
  - Availability calendar widget
  - "Book Now" primary CTA (large, prominent)
  - Trust badges (cancellation policy, instant confirmation)

### Search/Filter Bar
- Inline form fields with subtle borders
- Destination input (with icon)
- Date picker (calendar icon trigger)
- Guest selector (dropdown)
- Large search button (primary CTA styling)
- Mobile: Stacked fields, full-width button

### Availability Calendar
- Monthly grid view
- Available dates highlighted
- Price variations shown on hover
- Sold out dates clearly marked
- Selected date emphasized
- Navigation arrows for month switching

### Trust Elements
- Review cards: User photo, name, rating, quote, date
- Statistics bar: Total tours, happy customers, destinations
- Trust badges: Free cancellation, best price guarantee, 24/7 support
- Payment icons: Visa, Mastercard, etc.

### Feature Grid
- 2-3 columns on desktop
- Icon + Headline + Description pattern
- Icons: Simple line icons (large, 48x48)
- Balanced spacing, centered alignment
- Showcases: "Expert guides," "Small groups," "Flexible booking"

### Footer
- Multi-column layout: Company, Destinations, Support, Connect
- Newsletter signup (single input + button)
- Social media icons
- Payment/security badges
- Copyright + legal links
- Padding: py-12, subtle top border

---

## Page Structure

### Homepage Layout:

1. **Hero Section** (full viewport)
   - Stunning destination photography
   - Headline: "Discover Unforgettable Experiences"
   - Subheadline: Value proposition
   - Integrated search bar
   - Scroll indicator

2. **Featured Tours Section** (py-24)
   - Section header: "Popular Tours"
   - 3-column tour card grid
   - "View All Tours" CTA link

3. **Why Choose Us Section** (py-24)
   - 3-column feature grid
   - Icon-driven benefits
   - Trust-building messaging

4. **Destinations Showcase** (py-24)
   - Image gallery grid (masonry or uniform)
   - Destination name overlays
   - Click to filter tours by destination

5. **Social Proof Section** (py-16)
   - Statistics bar (Tours booked, 5-star reviews, Years operating)
   - Featured testimonials (3-column cards)

6. **Newsletter CTA** (py-16)
   - Centered content, max-w-2xl
   - Headline + email capture
   - Privacy assurance text

7. **Footer** (comprehensive)

### Tours Listing Page:

1. **Page Header** (py-12)
   - Breadcrumbs navigation
   - Page title + result count
   - View toggle (grid/list)

2. **Filter Sidebar + Results Grid**
   - Sidebar (lg:): Filters (price range, duration, category)
   - Main area: Tour cards grid (responsive columns)
   - Pagination or infinite scroll

3. **Footer**

### Tour Detail Page:

1. **Image Gallery + Booking Panel**
2. **Tour Information Tabs** (Description, Itinerary, Inclusions, Reviews)
3. **Related Tours** (similar experiences grid)
4. **Footer**

---

## Images

**Hero Image:** Yes - Large, full-width hero image required
- Placement: Homepage hero section (full viewport width)
- Content: Stunning travel photography (landscape, cultural experiences, adventure)
- Treatment: Subtle dark gradient overlay (top to bottom) for text contrast
- Specifications: High-resolution, optimized for web, aspect ratio 21:9 or 16:9

**Tour Card Images:**
- Placement: Top of each tour card
- Aspect ratio: 4:3 (consistent across all cards)
- Treatment: Rounded corners (rounded-xl), subtle hover scale effect
- Content: Tour-specific photography (landmarks, activities, scenery)

**Tour Detail Gallery:**
- Primary image: Large, above-fold (aspect 16:9)
- Thumbnails: 4-6 additional images in grid below primary
- Lightbox functionality for full-screen viewing

**Destination Images:**
- Grid showcase: Equal-sized tiles with location name overlays
- Aspect: Square (1:1) or landscape (16:9)

**Trust Elements:**
- Review photos: Small circular user avatars (optional, if available)
- No stock photography - authentic tour imagery only

---

## Interaction Patterns

**Navigation:**
- Smooth scroll to sections
- Sticky header with minimal animation
- Mobile menu slides from right

**Tour Cards:**
- Hover: Subtle elevation increase, image slight zoom
- Click: Navigate to tour detail page

**Booking Flow:**
- Calendar date selection → Guest count → Add-ons → Review → Payment
- Progress indicator for multi-step checkout

**Buttons:**
- Primary CTA: Prominent, high contrast (blue accent)
- Secondary: Outlined style
- Ghost: Minimal, text-based links
- Buttons on images: Blurred background (backdrop-blur-sm)

---

## Accessibility

- Focus indicators: Visible outline on all interactive elements
- Alt text: Descriptive for all tour images
- Form labels: Explicit associations
- Color contrast: WCAG AA minimum for text
- Keyboard navigation: Full site navigable without mouse
- Screen reader: Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels: Calendar, date pickers, modal dialogs

---

This design creates an elegant, conversion-focused booking experience that lets tour photography shine while maintaining professional clarity and effortless navigation.