# Mobile booking chat

## Scope

Customer and Owner now have a real **Tin nhắn** tab. Each conversation belongs to
one booking and its two participants. Open an existing conversation from the tab,
or use the chat button in Trip Detail / Owner Booking Detail to open or create it.
The header links back to that booking. Closed rooms keep their history and disable
sending. This feature does not add staff support-ticket chat.

- Text messages up to 2,000 characters; per-booking drafts stay in memory.
- Realtime messages via `/hubs/chat`, duplicate suppression, reconnect recovery,
  foreground reconciliation every 30 seconds, and unread badges across all rooms.
- Read requests require an active foreground room. Gallery, image picker,
  original-message viewer and notification overlays pause automatic reads.
  A failed read keeps the unread count and offers retry.
- Replies quote the original sender/text/images. Original messages can be fetched
  even if they are outside the loaded history.
- Camera/library images: JPG, PNG or WebP, at most four files and 5 MiB per file.
  Preview/remove files before sending; image-only messages are supported.
- Upload progress; failed sends preserve the draft and reuse a UUID retry key.
- Server search of the complete booking history (including image filenames),
  paginated search results, paginated image gallery and full-screen private images.
- Light/dark styling, keyboard avoidance, Android back handling and paginated,
  virtualized message history. Bottom navigation is hidden in the conversation.

## Backend prerequisite

Run the Backend with the booking-chat upgrade (`740c899` or a development commit
containing it). The basic text/history endpoints already existed; images, replies,
search and gallery require the upgraded endpoints. Missing/failed API responses
are shown as errors rather than successful empty data.

The Backend needs its existing MongoDB and Cloudinary configuration. There is no
new SQL migration. See Backend `docs/BOOKING_CHAT_UPGRADE.md` for private Cloudinary
delivery, upload validation, the MongoDB retry-key index and retention limitations.

Mobile always downloads images through the authenticated API client, including
its token-refresh flow. Provider attachment URLs are never used directly, and
access tokens are not embedded in URLs. Image data is held in memory while its
component is mounted, not deliberately written to a shared image cache.

## Run in the existing Android development build

In Android Studio's terminal, from `D:\MoveVN-Mobile-Android`:

```powershell
npx.cmd expo start --dev-client
```

Press `a` to open the installed development build on the emulator. If Metro is
already running for this directory, reload it (`r`). No new native dependency was
added by this feature, so an existing compatible development build can be reused.

Keep the Backend running. An Android emulator accesses a host API with
`http://10.0.2.2:5171` when the host Backend listens on that port. A physical phone
needs a reachable LAN/HTTPS API address instead. The project reads its existing
`EXPO_PUBLIC_API_BASE_URL` configuration.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npx.cmd expo export --platform android --output-dir .expo/chat-check
```

Automated tests exercise service payloads, pagination, retry keys, session/account
isolation, realtime reconnect, unread races, overlay read suppression, image
validation/private download, picker permission handling and screen interactions.
Network/picker/SignalR dependencies in these tests are mocked. Android export
verifies native module resolution and bundle compilation; it is not a live
two-device end-to-end test.

For final device acceptance, use test Customer/Owner accounts on the same booking:

1. Open the room from each role's booking detail and confirm the counterpart/code.
2. Exchange text, check unread badges outside the room and read after opening it.
3. Send an image with a caption and an image-only message; open both on the other
   account, reply to an older message and inspect the quoted original.
4. Search an old keyword and image filename; browse gallery/history pages.
5. Disconnect the network during sending and retry after recovery; verify no
   duplicate message and that another booking's draft remains unchanged.
6. Background/resume, switch account, use dark mode and open the keyboard; confirm
   reconnection, privacy and readable layout.

Real Cloudinary uploads, a shared database and two logged-in devices were not used
by the automated verification. No user messages are sent during those checks.
