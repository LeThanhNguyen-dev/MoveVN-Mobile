# Mobile vehicle favorites

## Usage

Sign in with a **Customer** account and switch to the Customer role. Save or remove
a vehicle using the heart on search results or Vehicle Detail. Open the saved list
from the home header's **Xe yêu thích** button or **Tài khoản → Yêu thích**.

The saved list supports refresh, retry, loading/empty states and pages of 12.
Open a saved vehicle to choose rental dates, check price/availability and enter
the existing booking flow. Android Back returns from the saved list to the previous
tab. Bottom navigation stays hidden inside that flow.

Only publicly approved vehicles are listed by the existing Backend API. A vehicle
that is hidden, unapproved or deleted may therefore disappear from this list even
if its ID remains saved. Displayed prices are reference prices; selecting rental
dates on Vehicle Detail obtains the current pricing quote.

## API and state

The feature reuses the existing authenticated Customer routes:

| Method | Route                                                | Purpose                            |
| ------ | ---------------------------------------------------- | ---------------------------------- |
| GET    | `/api/customer/favorite-vehicles/ids`                | All saved IDs for the current user |
| GET    | `/api/customer/favorite-vehicles?page=1&pageSize=12` | Visible saved vehicles             |
| PUT    | `/api/customer/favorite-vehicles/{vehicleId}`        | Save an approved vehicle           |
| DELETE | `/api/customer/favorite-vehicles/{vehicleId}`        | Remove a saved vehicle             |

No Backend change, SQL migration or native dependency is required. The same
account's favorites are shared with the web through the server. Mobile refreshes
on screen focus, app foreground and manual refresh; it does not subscribe to a
realtime favorites event.

- Hearts share one session-scoped store across list, detail and saved vehicles.
- Confirmed server writes update the UI. Failures retain the previous state and
  show an error instead of silently succeeding.
- Repeated taps on a pending vehicle are blocked; other vehicles remain usable.
- Unknown initial heart state offers a retry and does not guess add/remove.
- Logout, account change and leaving Customer mode clear in-memory favorites.
  Late responses from an earlier session are ignored.
- Mutations during a refresh cannot restore removed vehicles. Successful removals
  invalidate offset pagination and reload page one before loading more.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npx.cmd expo export --platform android --output-dir .expo/favorites-check
```

Tests cover authenticated service payloads, ID/list response validation, pagination,
save/remove failures, concurrent requests, session/role isolation, the actual home
entry, shared hearts, screen states, dark mode and Android Back handling. API
writes in tests are mocked and do not alter shared favorites.

The pulled development branch also introduced a native Platform dependency into
storage. Three existing Node test files now mock Android Platform alongside their
existing SecureStore mocks. The offline restore test follows development's current
behavior: the restore attempt completes while preserving the stored session.

For device acceptance, use a Customer test account on the same Backend as the web:
save a vehicle, open the saved list from both entry points, remove it, revisit its
detail and check that the heart matches. Verify the same list on web, retry with
network disconnected, and check account switching and rental date selection.
