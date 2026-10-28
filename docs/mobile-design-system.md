# Mobile UI conventions

Branch: `feature/de180783-mobile-design-system`.

## Structure

- `src/theme/tokens.ts`: semantic light/dark colours and the shared brand palette. `brand` is the accent for text and icons; `brandSolid` is the fill behind white button labels, including in dark mode.
- `src/theme/layout.ts`: spacing, radii, touch targets, type scale and surface styles.
- `src/theme/typography.ts`: only font families loaded by `useAppFonts` are mapped. Body text uses Be Vietnam Pro; display headings use Quicksand.
- `src/components/AppText.tsx`: font resolution, Vietnamese line spacing and preservation of explicit monospace fonts. System font scaling remains enabled.
- `src/components/ui`: shared button, input, compact screen header, card, page introduction, empty state and avatar. These components have no API or business dependencies.
- Existing feature wrappers (`BookingControls`, `TicketUi`) delegate to the shared UI while retaining their public contracts. Services, repositories, API payloads and navigation ownership remain within their existing modules.

## Applied screens

Customer and owner bottom tabs share a level, solid navigation bar, with discovery/overview first. Existing deals and messages remain reachable. Public mobile pages use `MobileBrandHeader` with the existing wordmark, notification bell and an accessible menu.

The supplied five-screen reference is applied to home, how it works, owner introduction, support and owner overview. Home uses a photograph from the web, an overlapping search card and recommendations directly after promotions. It preserves the actual Car/Motorbike search rather than introducing a driver service. `MobilityGuideScreen` provides the timeline and owner introduction; owner registration opens the existing verification workflow.

Primary gradients and segmented controls share `brandPalette`, `BrandButton` and `AppSegmentedControl`. The two new WebP photos are copied from the existing web assets (about 295 KB combined).

Owner overview is now separate from analytics. `ownerOverviewService` uses the existing calendar summary and Pending/Returned booking endpoints; the screen shows independent load failures instead of invented zero counts. Pending/returned tiles open the matching list filter; individual work items open their booking. Add vehicle opens the existing wizard. Detailed analytics and Excel export remain reachable from the overview.

Support uses the published CMS topic list, semantic category icons and a three-item accordion preview from actual CMS content. Role changes ignore stale responses. If no preview is available, category links still open the full FAQ. Ticket creation/history, phone and email remain connected.

The visual pass covers discovery/search, public and owner vehicle cards/details, customer/owner booking lists and details, the owner analytics introduction, chat list, favorites, voucher cards, account/profile, wallet header, authentication controls, verification/license headers, policies/FAQ/support headers, notifications and disputes. Support tickets and violations inherit the updated ticket controls and surfaces. Availability alerts use the updated theme and typography. Existing booking, checkout, contract and assistant components now use the shared text component.

## Rules for subsequent screens

- Use `AppScreenHeader` for navigation, and `AppPageIntro` only for an introduction within scrollable content. Avoid stacking a large banner above another title.
- Prefer dark body copy on white cards over the neutral page background. Purple marks titles/actions, while green, amber, blue and red convey status.
- Keep back navigation usable during loading unless leaving is explicitly disallowed by an in-flight form (`backDisabled`). Preserve existing permission, loading and validation checks.
- Use `AppInput` for ordinary visible form fields. Preserve native invisible OTP inputs and PIN digit layouts; these have different geometry and focus behaviour.
- Use minimum touch targets and content-driven heights. Do not use fixed-height text blocks or truncate important status labels. Names can truncate where the public profile remains reachable.
- Keep image error fallbacks. `AppAvatar` accepts a new image after an old URI fails.
- Reuse existing navigation callbacks. UI components do not fetch data or switch roles.

## Validation

`npx vitest run` exercises the feature regressions and shared UI. `mobileExperience.test.ts` and `ownerOverviewService.test.ts` cover overview navigation/filtering, independent load failures, refresh races, Vietnam date boundaries and stale FAQ content after role changes.

No app, emulator or Metro server was started for this work. Visual checks on real iOS/Android devices are still required, particularly for small screens, large system text, dark mode, keyboard avoidance and long Vietnamese names/statuses.

After installing the current SDK 58 dependencies, the full workspace type check reports existing React Native ref/FlatList/WebView typing incompatibilities and an incomplete public-profile test fixture. The newly added experience files type-check; the full project check is not yet clean. This pass does not change dependency versions or native configuration.

Device review: open the menu on Khám phá for Cách hoạt động / Dành cho chủ xe / Trung tâm hỗ trợ. Switch to Owner to review the operational overview, booking filters and add-vehicle action. Check narrow screens, large text, both themes and keyboard behaviour on the user's device.
