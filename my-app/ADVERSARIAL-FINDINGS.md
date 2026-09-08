# Adversarial Review — Findings

Scope: front-end-only prototype (no backend/DB/auth yet — see `TODO.md`). Findings
are grouped by severity and focus on what breaks as real data/users are introduced,
not hypothetical future work. Check a box off as you address each item.

---

## P0 — breaks as real data/users arrive

- [x] **1. Comment filter does a redundant nested-loop join, unmemoized**

  **File:** `src/app/components/comments/commentsection.tsx:10-27`

  **What's wrong:**
  ```tsx
  const visibleComments = commentList.filter((comment) => {
      const user = userList.find((user) => user.userID === comment.author); // scan #1
      if (props.selectedFilter === "all") return true;
      return user?.species === props.selectedFilter;
  });
  // ...later, in the render:
  {visibleComments.map((comment) => {
      const user = userList.find((user) => user.userID === comment.author) // scan #2 — same lookup, repeated
  ```
  `.filter()` loops over every comment (`C`), and for each one `.find()` linearly
  scans the entire `userList` (`U`) until it matches — a loop inside a loop, i.e.
  O(C × U). The exact same author lookup is then repeated a second time inside
  `.map()` for the same comment, doubling the work. None of it is memoized, so it
  reruns on *every* render of the component tree — including renders triggered by
  completely unrelated state (e.g. clicking the Save button on the post).

  **Why it matters:** With 12 comments and 12 users this is ~288 comparisons —
  invisible. Once `commentList`/`userList` come from a real database (per the SQL
  plan in `TODO.md`) with thousands of rows, this becomes hundreds of millions of
  comparisons per render, freezing the single-threaded UI on every filter click or
  unrelated re-render.

  **How to improve:**
  - Build an index once: `const userById = new Map(userList.map(u => [u.userID, u]))`.
    Looking up an author becomes O(1) via `userById.get(id)` instead of O(U) via
    `.find()`. Total complexity drops from O(C×U) to O(C+U).
  - Resolve each comment's author **once** and reuse it for both the filter check
    and the render — don't look it up twice.
  - Wrap the result in `useMemo(() => ..., [selectedFilter, commentList])` so it
    only recomputes when the filter or data actually changes.
  - Longer-term: once this is backed by a real DB, filtering by species should be a
    `WHERE`/`JOIN` in the query itself, not a full-table client-side scan.

  **Status (checked against current code):** Fixed. `commentsection.tsx:12`
  builds `userByID` once, the filter (line 16) looks up via `.get()`, and the
  render (line 22) now also uses `userByID.get(comment.author)` instead of a
  second `userList.find(...)` — the duplicate scan is gone and total work per
  render is O(C+U) instead of O(C×U). Remaining, non-blocking nice-to-have:
  `userByID`/`visibleComments` are still rebuilt on every render (no
  `useMemo`), including ones unrelated to comments — worth wrapping in
  `useMemo(() => ..., [selectedFilter, commentList, userList])` later, but
  it's a performance nicety now, not the Big-O bug this finding was about.

- [x] **2. Missing `key` prop on list renders**

  **Files:** `src/app/components/comments/commentsection.tsx:26`,
  `src/app/components/story/story-viewer.tsx:11`

  **What's wrong:** Neither `.map()` call passes a `key` to the returned element.
  React already warns about this in the console.

  **Why it matters:** At 12 static items this is cosmetic. Once comments/stories
  are inserted, removed, reordered, or filtered (which the species filter already
  does), React has no stable identity to reconcile elements against — expect
  misplaced DOM nodes, lost input focus, and content flashing under the wrong row
  once these lists become interactive (likes, replies, live updates).

  **How to improve:** Add `key={comment.commentID}` and `key={story.storyID}`
  respectively — both are already unique, stable IDs in the data.

  **Status:** Fixed — `commentsection.tsx:24` has `key={comment.commentID}`,
  `story-viewer.tsx:16` has `key={story.storyID}`.

- [x] **3. `comment.species` is a second, unenforced source of truth**

  **Files:** `src/types/types.ts:59`, `src/data/commentList.ts`,
  `src/app/components/comments/commentsection.tsx:17`

  **What's wrong:** `Comment` has its own `species` field, but the filter logic
  only ever reads `user.species` (the *author's* species via a join) — it never
  reads `comment.species`. The field is dead in the one place that does species
  filtering, but it still exists and could be read by future code.

  **Why it matters:** Nothing enforces that a comment's stored `species` agrees
  with its actual author. If any future feature (or a hand-edited seed row) trusts
  `comment.species` instead of joining through the author, results will silently
  disagree with what the filter shows today. Duplicated, unsynced data is a classic
  source of "the UI shows one thing, the report shows another" bugs.

  **How to improve:** Drop `species` from `Comment` entirely (already decided in
  `TODO.md`) and always derive it from the author via the join, so there is exactly
  one source of truth.

  **Status:** Fixed — `species` removed from the `Comment` interface
  (`types.ts`) and from every entry in `commentList.ts`. `npx tsc --noEmit`
  is clean; the only live species read is the author join in
  `commentsection.tsx:18`.

- [ ] **4. No feed exists — only one hardcoded post can render**

  **File:** `src/app/posts/page.tsx:34,56-104`

  **What's wrong:** The page hardcodes `postList[0]`, `userList[0]`, and
  `userList[4]` (line 79), and the `isLiked`/`isSaved` state lives on the page
  itself rather than per-post (lines 29-35).

  **Why it matters:** There is currently no code path for rendering more than one
  post. If a second post were added to `postList` today, it simply wouldn't
  render, and if the page were naively looped over all posts, every post would
  share the same single `isLiked`/`isSaved` state — liking one post would visually
  like all of them.

  **How to improve:** Extract a `PostCard` component that owns its own
  `isLiked`/`isSaved` state (and receives its own post/user data as props), then
  map over `postList` at the page level. This is already called out in
  `TODO.md`'s parking lot and should happen before real multi-post data lands.

---

## P1 — correctness/UX gaps that bite under real use

- [ ] **5. `CommentSpeciesFilter` has no active-state styling**

  **File:** `src/app/components/comments/commentspeciesfilter.tsx:19-41`

  **What's wrong:** None of the filter buttons render any different style/class
  based on `props.selectedFilter`. Clicking "alien" looks identical to clicking
  "all" — there's no visual confirmation of which filter is active.

  **Why it matters:** Purely a UX gap today, but it will make debugging much
  harder once more filter values or a tabbed layout (both planned in `TODO.md`)
  are layered on top, since there'll be no way to visually confirm the filter
  state matches the rendered comments.

  **How to improve:** Conditionally apply an "active" class/style, e.g.
  `className={props.selectedFilter === "alien" ? "filter-alien-active" : "filter-alien-species"}`,
  or use `aria-pressed={props.selectedFilter === "alien"}` for accessibility.

- [ ] **6. Like count is a hardcoded client-side constant with no persistence**

  **File:** `src/app/posts/page.tsx:30-31`

  **What's wrong:** `const startingLikeCount = 324;` is a magic number baked into
  the page, and toggling `isLiked` just adds/subtracts 1 in local component state
  — nothing is persisted anywhere.

  **Why it matters:** Already correctly flagged in `TODO.md`. Calling it out here
  because it's a direct example of the pattern to avoid repeating elsewhere: UI
  state standing in for data that should come from (and be written back to) a
  real data source.

  **How to improve:** No action needed beyond what `TODO.md` already plans (wire
  to the DB once the backend lands) — listed here for completeness, not as new
  work.

---

## P2 — hygiene / DX

- [ ] **7. No test harness or CI**

  **What's wrong:** No test files, no CI config anywhere in the repo.

  **Why it matters:** Reasonable for a pre-backend prototype — don't over-invest
  here yet. But the comment-filter join (finding #1) is the one piece of actual
  business logic in the app today, and it's exactly the kind of logic that's easy
  to silently break while refactoring toward the SQL migration.

  **How to improve:** Add a minimal Vitest + React Testing Library setup, and
  write the first test against the comment filter's behavior (filtering by
  species, "all" returning everything, unknown author handled gracefully) before
  touching its implementation.

- [x] **8. Debug/instructional comments left in shipped files**

  **File:** `src/app/components/comments/commentsection.tsx:20-22`

  **What's wrong:**
  ```
  // n.b might be overengineered. we are doing a 4 loop in a four loop.
  // no issues with stte of data YET. Would recommend this function from line 10-18 to GPT. ask
  // where inefficiencies are and how to improve (pattern wise). look up big 0!
  ```
  This is a personal note-to-self, not documentation — and the underlying
  intuition is correct (see finding #1).

  **Why it matters:** Harmless while learning, but it should become an actual fix
  (finding #1) rather than staying a comment, and stripped once resolved so future
  readers aren't left wondering if it's still an open question.

  **How to improve:** Delete the comment once finding #1 is fixed; the `useMemo`
  + `Map` index it's pointing at *is* the answer to the question it's asking.

  **Status:** Fixed — the note-to-self is gone from `commentsection.tsx`,
  replaced with a factual one-liner about the `Map` lookup's complexity.
