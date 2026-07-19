import IndividualStory from "./individual-story"

// story viewer top level
const users = [
    {userName: "Eli", userPFP:"https://image-cdn.hypb.st/https%3A%2F%2Fhypebeast.com%2Fimage%2F2021%2F10%2Fbored-ape-yacht-club-nft-3-4-million-record-sothebys-metaverse-1.jpg?w=1440&cbr=1&q=90&fit=max", userLocation: "Quahog"},
    {userName: "Bobby", userPFP:"https://observer.com/wp-content/uploads/sites/2/2021/08/Yuga-Labs-Bored-Ape-Yacht-Club-5812.jpg", userLocation: "Ryloth"},
    {userName: "Jamie", userPFP:"https://image-cdn.hypb.st/https%3A%2F%2Fhypebeast.com%2Fimage%2F2021%2F10%2Fbored-ape-yacht-club-nft-3-4-million-record-sothebys-metaverse-1.jpg?w=1440&cbr=1&q=90&fit=max", userLocation: "Aspen"},
    {userName: "Jack", userPFP:"https://image-cdn.hypb.st/https%3A%2F%2Fhypebeast.com%2Fimage%2F2021%2F10%2Fbored-ape-yacht-club-nft-3-4-million-record-sothebys-metaverse-1.jpg?w=1440&cbr=1&q=90&fit=max", userLocation: "Tattoine"}]

export function StoryViewer() {
    return (
    <div className="story-viewer">
        <p>This is where our stories go!</p>
        {(users.map(user => <IndividualStory
            key={user.userName}
            userPFP={user.userPFP}
            userName={user.userName}
            userLocation={user.userLocation}
            />
        ))}
    </div>
    )
}