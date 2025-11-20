# Tour Booking Website - Design Guidelines

## Design Approach

**Selected Approach:** Reference-Based - Luxury Travel Platform
**Primary References:** Flights and Packages, luxury travel agencies, premium booking platforms
**Rationale:** Image-driven experience showcasing 800+ tours through rich photography. Fullscreen carousel hero and overlay-based cards create immersive, luxurious browsing that emphasizes destinations over interface chrome.

**Core Principles:**
- Photography dominates every section
- Overlaid content for maximum visual impact
- Luxurious spacing and generous imagery
- Sophisticated travel agency professionalism

---

## Typography System

**Font Stack:** 'Inter' via Google Fonts (400, 500, 600, 700)

**Hierarchy:**
- Hero Headline: text-5xl md:text-7xl font-bold (tracking-tight)
- Page Titles: text-4xl md:text-5xl font-bold
- Section Headers: text-3xl md:text-4xl font-semibold
- Tour Card Titles: text-2xl font-bold
- Category Labels: text-lg font-semibold
- Body Text: text-base leading-relaxed
- Price Display: text-3xl font-bold
- Duration/Meta: text-sm font-medium uppercase tracking-wide

---

## Layout System

**Spacing Primitives:** Tailwind units 4, 6, 8, 12, 16, 24

**Grid Structure:**
- Container: max-w-7xl mx-auto px-6 md:px-8
- Tour Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6
- Featured Tours: grid grid-cols-1 lg:grid-cols-2 gap-8
- Detail Layout: Two-column lg:grid-cols-5 (gallery spans 3, sidebar spans 2)

**Vertical Rhythm:**
- Hero: Full viewport (min-h-screen)
- Sections: py-16 md:py-24
- Cards: Aspect ratio 3:4 (portrait) for tour cards
- Tight components: py-8

---

## Component Library

### Navigation Bar
- Fixed transparent with backdrop blur on scroll
- Logo left, primary links center, search icon + account right
- Height: h-24, minimal borders
- Mobile: Full-screen overlay menu

### Hero Carousel
- Fullscreen rotating carousel (5-7 slides)
- Auto-advance every 6 seconds
- Large travel imagery (beaches, mountains, cultural sites)
- Content overlay: Centered headline + subheadline + primary CTA
- Carousel indicators (dots) bottom center
- Navigation arrows left/right edges
- Gradient overlay (dark bottom fade) for text readability
- Blurred background buttons (backdrop-blur-md)

### Horizontal Category Pills
- Scrollable row (overflow-x-auto, hide scrollbar)
- Pills: Rounded-full px-6 py-3, text-sm font-semibold
- Active state: Distinct styling (filled vs outlined)
- Categories: "All Tours," "Adventure," "Cultural," "Food & Wine," "Beach," "City Breaks," etc.
- Positioned below hero or as section filter

### Tour Card - Overlay Style
- Portrait aspect ratio image (3:4)
- Content overlaid on bottom third with gradient
- Rounded-xl corners, overflow hidden
- Overlay content:
  - Duration badge top-left (absolute position)
  - Favorite icon top-right
  - Bottom overlay: Tour title, location, rating stars, price
- Hover: Subtle image zoom, no elevation change
- Price displayed prominently "From £XXX"

### Search Bar - Advanced
- Prominent positioning (below hero or sticky)
- Multi-field: Destination autocomplete, date range picker, guests, tour type
- Large primary search button
- Expandable filters: Price range, duration, difficulty, ratings
- Mobile: Modal overlay for full search experience

### Tour Detail Page Layout

**Image Gallery (spans 3 columns):**
- Hero image fullscreen lightbox capability
- Grid of 6-8 additional images below (2x3 or 2x4 grid)
- All images clickable for gallery view

**Booking Sidebar (spans 2 columns, sticky):**
- Tour title, location, rating summary
- Price breakdown table
- Availability calendar (monthly view)
- Guest selector
- Date picker integration
- Total price calculator
- Large "Book Now" CTA
- Trust badges: Free cancellation, instant confirmation, secure payment

**Information Tabs:**
- Tab navigation: Overview, Itinerary, What's Included, Reviews, FAQs
- Each tab: Rich content with icons, formatted lists, expandable sections
- Itinerary: Day-by-day breakdown with timing and activities
- Reviews: User photos, ratings, verified badges, sort/filter options

### Destination Showcase Section
- Masonry grid or uniform tiles (6-8 destinations)
- Image with location name overlay (bottom gradient)
- Tour count badge ("120+ tours")
- Click to filter tours by destination

### Featured Tours Grid
- 4-column responsive grid (xl:grid-cols-4)
- Showcase 12-16 tours on homepage
- Section header with "View All" link
- Uses overlay-style tour cards

### Filter Sidebar (Tours Listing)
- Collapsible categories
- Price range slider
- Multi-select checkboxes: Duration, difficulty, rating, category
- Clear filters button
- Mobile: Bottom sheet drawer

### Trust & Social Proof
- Statistics bar: "2M+ travelers," "15K+ tours," "98% satisfaction"
- Testimonial cards: Large quotes, customer photo, name, location
- Awards/certifications badges
- Payment provider logos

### Newsletter Capture
- Fullwidth section with background image overlay
- Centered content (max-w-2xl)
- Headline + benefits list
- Single email input + submit button
- Privacy assurance text

### Footer
- Multi-column: Company, Destinations, Support, Legal, Connect
- Newsletter signup duplicate
- Social media icons
- Payment/security badges
- Language/currency selectors
- Copyright, terms, privacy links

---

## Page Structures

### Homepage:
1. Hero Carousel (fullscreen)
2. Horizontal Category Pills (py-8)
3. Featured Tours Grid (py-24, 12-16 cards)
4. Destination Showcase (py-24)
5. Why Book With Us (py-24, 3-column features with icons)
6. Testimonials (py-24, 3-column cards)
7. Statistics Bar (py-16)
8. Newsletter CTA (py-24, image background)
9. Footer

### Tours Listing:
1. Page Header (breadcrumbs, title, result count)
2. Search Bar + Category Pills
3. Filter Sidebar + Tours Grid (4-column)
4. Pagination
5. Footer

### Tour Detail:
1. Gallery + Booking Sidebar (two-column)
2. Information Tabs
3. Related Tours (4-column grid)
4. Footer

---

## Images

**Hero Carousel Images:** Required
- Placement: Homepage fullscreen carousel (5-7 rotating slides)
- Content: Diverse travel scenes (tropical beaches, mountain vistas, cultural landmarks, urban skylines, adventure activities)
- Treatment: Dark gradient overlay (bottom 40%), slight zoom on slide transition
- Specifications: High-resolution 16:9 landscape, hero-quality photography

**Tour Card Images:**
- Placement: Every tour card, portrait orientation
- Aspect: 3:4 with gradient overlay on bottom third
- Content: Destination-specific imagery matching tour type
- Treatment: Rounded-xl corners, subtle zoom on hover

**Tour Detail Gallery:**
- Primary hero image: Fullscreen lightbox-enabled
- Additional images: 6-8 image grid below hero
- Treatment: Consistent aspect ratios, professional photography

**Destination Showcase:**
- Tiles: Uniform or masonry layout
- Content: Iconic destination imagery with overlaid labels
- Treatment: Gradient overlays for text readability

**Newsletter Section:**
- Background: Fullwidth image with overlay
- Content: Travel-themed imagery (sunset, landmarks)

---

## Accessibility

- Focus indicators on all interactive elements
- Alt text for all imagery
- Keyboard navigation: Full carousel control, filter sidebar, modals
- ARIA labels: Carousel, date pickers, tabs, expandable sections
- Color contrast: WCAG AA compliance for overlaid text
- Screen reader: Proper heading hierarchy, image descriptions
- Form labels: Explicit associations for all inputs

---

This design creates a luxurious, image-first booking platform where photography drives desire and sophisticated overlays maintain usability without compromising visual impact.