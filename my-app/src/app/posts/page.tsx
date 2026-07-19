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

export default function SecondHome() {
    return (
    <div className="app">
        <div>
        <div className="title">
            <Title/>
            <InputSearchBar/>
            <TopRightButtons/>
        </div>
        <div className="story-row">
            <div className="stories">
            <StoryViewer/>
            </div>
        </div>
        <div className="post">
            <PostHeader posterPFP="Bossk" posterUserName="https://static.wikia.nocookie.net/starwars/images/1/1d/Bossk.png/revision/latest?cb=20130219044712" posterLocation="Trandosha"/>
            <PostMain/>
            <div className="buttons">
            <ButtonsLeft/>
            <ButtonsRight/>
            </div>
            <PosterRow/>
            <div className="liked-by-section">
            <LikedBySection likedByName="Dengar" likedByIMGURL="https://via.placeholder.com/150" likedByNumber={324}/>
            </div>
        </div>
        <div className="comment-section-bundle">
        <div className="comment-header">
        <h2>Comment section</h2>
        </div>
        <div className="comment">
        <CommentSection commentSectionUsername="OGDOGE" commentSectionComment="This is a comment" commentSectionPFPURL="https://via.placeholder.com/150" />
        <CommentSection commentSectionUsername="JungleJim" commentSectionComment="This is a comment" commentSectionPFPURL="https://via.placeholder.com/150" />
        <CommentSection commentSectionUsername="TruffleShuffle" commentSectionComment="This is a comment" commentSectionPFPURL="https://via.placeholder.com/150" />
        </div>
        </div>
        </div>
    <div className="add-comment">
        <AddCommentButton/>
    </div>
    </div>
    )
}