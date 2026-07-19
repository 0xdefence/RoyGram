import IndividualStory from "./individual-story"
import { storyList } from "@/data/storyList"

// story viewer top level
export function StoryViewer() {
    return (
    <div className="stories">
        {(storyList.map(story => 
        <IndividualStory
            storyID={story.storyID}
            postLocation={story.postLocation}
            postDate={story.postDate}
            likeCount={story.storyID}
        />
        ))}
    </div>
    )
}