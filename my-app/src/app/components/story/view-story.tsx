import { Story } from "@/types/types";

interface ViewStoryProps {
    storyDisplay: Story["storyURL"];
}

export function ViewStory(props: ViewStoryProps) {

    return (
    <div className="IG-Story-View">   
       <div className="IG-Story-Title">
        <h1> This is the IG Story!</h1>
        </div>
        <div className="IG-Story">
            src={props.storyDisplay}
        </div>
    </div>
    )
}