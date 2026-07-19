// we will be using props, or property: vars we define from a 
// top level! 

import { Story, StoryID, UserPFP } from "@/types/types";

interface IndividualStoryProps {
    storyID: StoryID;
    userName: Story["author"]; 
    userLocation: Story["postLocation"];
    userPFP: UserPFP;
}

export default function IndividualStory(props: IndividualStoryProps) {
    const userName = props.storyID;
    const userLocation = props.userLocation;
    const userPFP = props.userPFP;

    return (
    <div>
    <img className="individual-pfp"
        src={userPFP}/>
        <div className="individual-nametag">
            {userName}
        </div>
        <div className="individual-location">
            {userLocation}
        </div>
    </div>
    )
}

