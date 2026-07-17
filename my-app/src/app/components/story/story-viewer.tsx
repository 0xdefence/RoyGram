// story viewer top level
const users = [{userName: "Eli", userLocation: "Quahog"},
    {userName: "Bobby", userLocation: "Krabby Patty"},
    {userName: "Jamie", userLocation: "Aspen"},
    {userName: "Jack", userLocation: "Tattoine"}]

export function StoryViewer() {
    return (
    <div className="story-viewer">
        <p>This is where our stories go!</p>
        {users.map(users)}
    </div>
    )
}