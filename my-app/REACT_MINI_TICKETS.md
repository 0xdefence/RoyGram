# React Mini Tickets

These tickets are practice exercises for learning React through RoyGram. Complete
them in order. They intentionally describe behaviour and constraints without
providing the finished code.

## Ground rules

- Do not change code until you have completed the pre-coding framework below.
- Work on one ticket at a time.
- Make the smallest change that satisfies the current acceptance criteria.
- Test after every small step.
- When stuck, write down what you expected and what actually happened before
asking for a hint.
- Do not mutate imported data or React state directly.
- Do not introduce `useEffect` unless you can name the external system it
synchronizes with.



## The PAUSE framework

Complete this framework in writing before touching code for every ticket. Put
your answers in a notebook, issue, or beneath the ticket in a temporary working
note.

### P — Paraphrase the behaviour

Describe the feature in your own words without mentioning code.

Questions:

- What should the user be able to do?
- What visible change should happen?
- What should happen when the user repeats the action?



### A — Account for the data

List the minimum information the interface must remember.

For every piece of information, record:


| Question                                                    | Your answer |
| ----------------------------------------------------------- | ----------- |
| What does this value represent?                             |             |
| What type is it: boolean, string, number, array, or object? |             |
| What is its initial value?                                  |             |
| What event changes it?                                      |             |
| Which UI reads it?                                          |             |
| Can it be calculated from existing state instead?           |             |


If a value can be calculated during rendering, it probably does not need its
own state.

### U — Understand ownership and flow

Draw a small component tree for the affected area.

Example shape:

```text
Parent
├── Component that triggers the change
└── Component that displays the result
```

Then answer:

- What is the closest common parent of the components that need the value?
- Which component should own the state?
- Which child receives data?
- Which child receives an event handler?
- What props must cross each boundary?

Remember: data travels down through props. A child requests a change by calling
a function passed down by its parent.

### S — Sketch states and events

Before writing JSX, make a state table:


| Current state | User event | Next state | Visible result |
| ------------- | ---------- | ---------- | -------------- |
|               |            |            |                |


Also list relevant edge cases, such as:

- Empty input
- Repeated clicks
- Different letter casing
- No matching results
- Submitting only spaces



### E — Establish proof

Decide how you will prove the feature works.

Write:

1. The exact manual steps you will perform.
2. The expected result after each step.
3. One edge case you will test.
4. What existing behaviour must still work.

Only after completing **P, A, U, S, and E** should you edit the code.

## While-coding loop

Use this loop for each small change:

1. **Predict:** Say what you expect the next change to do.
2. **Change:** Make one small, focused edit.
3. **Observe:** Run the app and inspect the result.
4. **Explain:** Explain why the result occurred.
5. **Record:** Note errors and what fixed them.

If you cannot explain the result, pause before adding more code.

## Hook decision checklist



### Consider `useState` when

- A value must survive a render.
- An interaction changes the value.
- Changing it should update the UI.

Ask: “If React forgets this value during the next render, will the feature
break?”

### Consider `useEffect` when

React must synchronize with something outside its normal rendering process,
such as:

- The browser document title
- Local storage
- A timer
- A network request
- A third-party library

Before using an effect, complete this sentence:

> When ______ changes, synchronize ______ by doing ______.

The first blank usually helps identify the dependency. The second blank must be
an external system. If it is only another React value, calculate that value
during rendering instead.

## Ticket 1 — Save and unsave a post

**Difficulty:** Easy  
**Primary concept:** Boolean state  
**Starting area:** `src/app/components/post/postButtons.tsx`

### User story

As a user, I want to click the bookmark icon to save or unsave a post so that I
can see whether I have marked it for later.

### Acceptance criteria

- Clicking the bookmark changes the saved state.
- The bookmark has visibly different saved and unsaved appearances.
- Clicking it again returns it to the original appearance.
- The existing like behaviour still works.



### Constraints

- Represent saved/unsaved with a boolean.
- Use a CSS class to control the visible appearance.
- Do not manipulate the DOM directly.



### Questions to answer before coding

- Does any component other than `ButtonsRight` currently need to know the saved
state?
- What would make local state appropriate?
- What future requirement might cause you to lift the state into `SecondHome`?



### Proof checklist

- [ ] Starts unsaved
- [ ] First click shows saved
- [ ] Second click shows unsaved
- [ ] Like button still works independently
- [ ] Browser console contains no new errors



## Ticket 2 — Show and hide comments

**Difficulty:** Easy  
**Primary concepts:** Boolean state, conditional rendering, props  
**Starting areas:** `src/app/posts/page.tsx` and
`src/app/components/post/postButtons.tsx`

### User story

As a user, I want to click the comment icon to show or hide the comments so that
I can control how much content is visible.

### Acceptance criteria

- Comments begin in a clearly chosen state: visible or hidden.
- Clicking the comment icon toggles the comment section.
- Repeated clicks reliably alternate between the two states.
- Likes and saves remain unaffected.



### Constraints

- Use conditional rendering.
- The component owning the state must be able to coordinate the button and the
comment section.
- Pass an event handler through props where required.
- Do not find or hide the element using a DOM query.



### Questions to answer before coding

- Which component renders both the action buttons and comment section?
- Why might that component be the correct state owner?
- What prop type describes a function that takes no arguments and returns
nothing?



### Proof checklist

- [ ] Initial visibility matches the written decision
- [ ] One click changes visibility
- [ ] A second click restores it
- [ ] Like and save states do not reset
- [ ] Browser console contains no new errors



## Ticket 3 — Controlled search input

**Difficulty:** Easy–medium  
**Primary concepts:** String state, controlled inputs, change events  
**Starting area:** `src/app/components/header/inputsearchbar.tsx`

### User story

As a user, I want to type into the search field so that RoyGram remembers and
displays my search query.

### Stage A acceptance criteria

- The static search text is replaced by a text input.
- The input displays exactly what the user types.
- The current query is displayed somewhere nearby for learning and debugging.
- Clearing the input also clears the displayed query.



### Stage B acceptance criteria

- The query filters users from `userList`.
- Matching is case-insensitive.
- An empty query has deliberately chosen behaviour.
- A helpful message appears when there are no matches.



### Constraints

- Make the input controlled with `value` and `onChange`.
- Store only the query in state.
- Calculate filtered results from the query and `userList`; do not store both
unless you can justify why both must be state.
- Do not use `useEffect` to calculate the filtered list.



### Questions to answer before coding

- What type of state represents the query?
- Which event contains the new input value?
- What string method could normalize letter casing?
- Should an empty query show everyone, no one, or a prompt? Why?



### Proof checklist

- [ ] Typing updates the input
- [ ] Backspace updates it correctly
- [ ] Clearing produces the planned empty state
- [ ] Uppercase and lowercase searches behave the same
- [ ] A nonsense query shows the no-results state



## Ticket 4 — Synchronize the browser title

**Difficulty:** Medium  
**Primary concept:** `useEffect`  
**Starting area:** `src/app/posts/page.tsx`

### User story

As a user, I want the browser-tab title to reflect whether I liked the post so
that the tab stays synchronized with the current UI state.

### Acceptance criteria

- The tab has one title when the post is unliked.
- Liking the post changes the tab title.
- Unliking it restores the unliked title.
- The title does not update because of unrelated interactions.



### Constraints

- Use an effect because the browser document title is outside React's rendered
JSX.
- Include only the dependency required by the synchronization.
- Do not create a second state value for the title.



### Questions to answer before coding

Complete the effect sentence:

> When ______ changes, synchronize ______ by doing ______.

Then answer:

- What value should appear in the dependency array?
- What would happen if the dependency array were omitted?
- Why is the title not another piece of React state?
- Does this effect require cleanup? Explain your reasoning.



### Proof checklist

- [ ] Initial tab title is correct
- [ ] Like changes the tab title
- [ ] Unlike restores it
- [ ] Save and comment actions do not change it
- [ ] You can explain when the effect runs



## Ticket 5 — Add a comment

**Difficulty:** Medium  
**Primary concepts:** Input state, array state, forms, immutable updates  
**Starting areas:** `src/app/components/comments/commentbutton.tsx`,
`src/app/components/comments/commentsection.tsx`, and
`src/app/posts/page.tsx`

### User story

As a user, I want to write and submit a comment so that it immediately appears
in the visible comment list.

### Stage A acceptance criteria

- A text input remembers the draft comment.
- A submit action responds to a click or form submission.
- The draft input clears after a valid submission.
- Empty or whitespace-only comments are not added.



### Stage B acceptance criteria

- A submitted comment is added to the displayed list.
- Existing comments remain visible.
- Multiple comments can be submitted.
- Each rendered comment has a stable, unique React key.



### Constraints

- Keep the draft string and displayed comments as separate concepts.
- Do not call `.push()` on the state array.
- Do not modify the imported `commentList`.
- Create a new array when adding a comment.
- Pass comment data into `CommentSection` through props.
- Prevent the form's default browser behaviour if you use form submission.



### Questions to answer before coding

- Which component needs access to both the form and rendered list?
- Where should the comments array state live?
- What should the comments state use as its initial value?
- What fields are required by the `Comment` interface?
- How will you create a stable identifier for a new practice comment?
- Why is mutating an imported array risky?



### Proof checklist

- [ ] Existing comments appear initially
- [ ] A valid comment appears after submission
- [ ] Existing comments remain after adding it
- [ ] The input clears
- [ ] Empty input is rejected
- [ ] Whitespace-only input is rejected
- [ ] Two submitted comments both remain visible
- [ ] Browser console has no missing-key warning



## Ticket completion reflection

After every ticket, answer:

1. What state did I introduce, and why did it need to be state?
2. Which component owned it, and why?
3. How did data travel through the components?
4. Which event caused the state transition?
5. What caused React to render again?
6. What was my most useful mistake?
7. What would I improve if this feature grew larger?

Do not mark a ticket complete until you can explain the feature without reading
the code line by line.

## Definition of done

A ticket is done when:

- [ ] The PAUSE framework is completed
- [ ] Every acceptance criterion passes
- [ ] Every proof-checklist item is checked
- [ ] Existing features still work
- [ ] No new console errors or warnings appear
- [ ] The completion reflection is answered
- [ ] You can explain why each state value and effect exists