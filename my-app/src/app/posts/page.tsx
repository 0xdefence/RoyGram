// this is how we define react files 
// we are using named exports where we use the variable is tied to how we would import it
// we'd give a name 
// a DEFAULT export means the DEFAULT of the file wrote the code in, either 0 or 1
// it doesn't need to be the same name. you have a 1-1 
// react must ALWAYS Start with capital! 
import { Title } from "../components/header/title"
import { InputSearchBar } from "../components/header/inputsearchbar";
import { TopRightButtons } from "../components/header/toprightbuttons";
import PostHeader from "../components/post/postingheader"
import { PostMain } from "../components/post/postMain";
import { ButtonsLeft, ButtonsRight } from "../components/post/postButtons";
import { CommentSection } from "../components/comments/commentsection"
import { StoryViewer } from "../components/story/story-viewer"
import { PosterRow } from "../components/post/posterRow";
import { LikedBySection } from "../components/liked-by/likedbysection";
import { AddCommentButton } from "../components/comments/commentbutton";
import { CommentSectionTitle } from "../components/comments/commentsectionheader";

export default function SecondHome() {
    return (
        <div className="app">
            <div>
                <div className="title">
                    <Title />
                    <InputSearchBar />
                    <TopRightButtons />
                </div>
                <div className="story-row">
                    <div className="stories">
                        <StoryViewer />
                    </div>
                </div>

                <div className="post">
                    <PostHeader posterPFP="Bossk" posterUserName="https://static.wikia.nocookie.net/starwars/images/1/1d/Bossk.png/revision/latest?cb=20130219044712" posterLocation="Trandosha" />
                    <PostMain />
                    <div className="buttons">
                        <ButtonsLeft />
                        <ButtonsRight />
                    </div>
                    <div>
                        <LikedBySection likedByName="Dengar" likedByIMGURL="https://via.placeholder.com/150" likedByNumber={324} />
                    </div>
                    <div>
                        <PosterRow />
                    </div>

                    <div className="comment-section-bundle">
                        <CommentSectionTitle />
                        <div className="comment">
                            <CommentSection />
                        </div>
                        <div>
                            <AddCommentButton />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
