import IndividualStory from "./individual-story"
import { storyList } from "@/data/storyList"
import { userList } from "@/data/userList"

// story viewer top level
// .find() searches userList for the user whose userID matches story.author
export function StoryViewer() {
    return (
        <div className="stories">
            {storyList.map((story) => {
                const user = userList.find((user) => user.userID === story.author)
            return (
            <IndividualStory
                storyID={story.storyID}
                userLocation={story.postLocation}
                userPFP={story.userPFP}
                userName={user?.userName ?? "Unknown"}
            />
    )})}
        </div>
    )
}