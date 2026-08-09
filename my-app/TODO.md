# RoyGram — To-Do

Track progress by ticking the boxes. Sections are roughly ordered by priority,
not by difficulty.

---

## 1. New features

### Stories

- [ ] Clicking a story opens it full-screen, from **all** entry points:
  - [ ] Story row
  - [ ] Poster story (avatar on the post itself)
  - [ ] "Liked by dengar" row
- [ ] Unviewed stories get a red/gradient ring around the avatar

### Comments

- [ ] Like button on each comment
- [ ] Like **count** displayed next to the like button
- [ ] Sub-comments (replies nested under a comment)
- [ ] "Add comment" buttons/inputs wherever comments can be posted
- [ ] Timestamps on comments
  - [ ] Store a real date per comment
  - [ ] Render as relative time since posted — seconds, minutes, hours, days, **weeks**

---



## 2. Clean-up



### Styling

- [ ] Touch up the various on-screen elements to be 1:1 with Instagram
- [ ] Fix the styling issues in `src/app/globals.css`
- [ ] **Open question:** split `globals.css` into separate per-component CSS files?



### Species filter

- [ ] Clean up the species filter
- [ ] Move the dropdown into a "Comment Section" tab
  - Idea: clicking **"Comment Section"** downsizes/collapses the comments
- [ ] **Open question:** how should the dropdown clicks behave?
- [ ] **Open question:** can the same pattern route to Messages / All Likes?
  - [ ] Add an image to that view?

---



## 3. Data layer

**Decided:** we go full-stack with a real SQL database. The static arrays in
`src/data/` become `seed.sql`. Driving reason: "unviewed story ring" is
per-viewer state, which static arrays cannot model at all.

- [ ] **Open question:** pick the engine — Postgres 18 (recommended) vs MariaDB 11
  - Postgres wins on `TIMESTAMPTZ` (timezone correctness by type, not
    convention) and on free managed hosting for a live demo URL
  - MariaDB if we specifically want MySQL-dialect reps; same schema either way

### Schema
- [ ] Keep the VARCHAR IDs (`HTR-002`, `CMT-001`) — **decided**
- [ ] Drop every stored `*_count` column — counts are derived via `COUNT(*)`
  - `Comment.replyCount` currently claims 2 replies that don't exist
- [ ] Drop `species` from Post / Comment / Story — derive from author via JOIN
  - It's already dead: `commentsection.tsx` filters on `user.species`, not `comment.species`
- [ ] Add `parent_comment_id` (self-referencing FK) to `comments` for replies
- [ ] Join tables: `post_likes`, `comment_likes`, `post_saves`, `story_views`
  - Composite PK `(user_id, target_id)` — the DB refuses double-likes
- [ ] `created_at` as full UTC timestamps, spread across hours/minutes so the
  relative-time formatter is actually testable

### Plumbing
- [ ] `docker-compose.yml` with `./db/init` mounted to `/docker-entrypoint-initdb.d`
  so `docker compose up` yields a seeded DB on first boot
- [ ] Hand-written SQL in `src/db/queries/` — no ORM. Always parameterized (`?`/`$1`).
  Components import query functions, never a connection.
- [ ] Convert `posts/page.tsx` to an async Server Component (it's `"use client"` today)
- [ ] Server Actions for mutations + `useOptimistic` so likes feel instant
- [ ] `output: "standalone"` in `next.config.ts` for a small production image

---



## 4. Auth

Faked for now, real later. The seam is one function so the swap is cheap.

- [ ] `getCurrentUser()` in `src/lib/session.ts` returning a hardcoded user
- [ ] Every query takes `viewerId` as a parameter from day one — today from the
  constant, later from the session. This is what makes the swap a one-file change.
- [ ] **Later:** replace with [Better Auth](https://better-auth.com)
  - `species` / `age` become `additionalFields` on the Better Auth user
  - Custom `generateId` so our VARCHAR IDs survive
  - Do **not** hand-roll a `password_hash` column — Better Auth owns credentials

---



## Notes / parking lot

- Comment dates feed the relative-time formatter — get the data shape right
before building the UI.
- The like count and like button on comments should ship together.
- Missing `key` props on every `.map()` (`commentsection.tsx`, `story-viewer.tsx`)
— React is warning about this right now.
- We only ever render `postList[0]`. Rendering a real feed means the per-post
`isLiked` state has to move out of the page and down into each post row.

