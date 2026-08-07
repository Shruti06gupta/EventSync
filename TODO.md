# EventSync - Search Bar Flicker Fix TODO

## Steps
- [x] Analyze Events.jsx and identify root cause
- [x] Add `debouncedSearch` state synced from `search` via 300ms debounce
- [x] Use `debouncedSearch` in the data-fetching effect and API params
- [x] Remove `setLoading(true)` from subsequent fetches so the grid stays mounted
- [x] Verify only the event list updates (no layout shift) while typing
- [x] Confirm clean indentation and build passes
