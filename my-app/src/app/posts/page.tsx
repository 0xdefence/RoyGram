// this is how we define react files 
// we are using named exports where we use the variable is tied to how we would import it
// we'd give a name 
// a DEFAULT export means the DEFAULT of the file wrote the code in, either 0 or 1
// it doesn't need to be the same name. you have a 1-1 
// react must ALWAYS Start with capital! 
import { StoryViewer } from "../components/story/story-viewer"

export default function SecondHome() {
    const bananas = 2;
    const randomBananas = bananas * Math.random();
    return (
        <div>
            This is the post page. We have {randomBananas} bananas 🍌!
        <StoryViewer>
        </StoryViewer>
        </div>
    )
}