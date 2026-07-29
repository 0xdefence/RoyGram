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

- [ ] Decide whether we need a seeded database
  - [ ] If yes: pick the storage (SQL? file-based seed? in-memory mock?)
  - [ ] Seed posts, comments, users, stories
- [ ] **Open question:** do we add SQL in, or keep the current static imports?

---



## Notes / parking lot

- Comment dates feed the relative-time formatter — get the data shape right
before building the UI.
- The like count and like button on comments should ship together.

