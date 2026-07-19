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
    const bananas = 2;
    const randomBananas = bananas * Math.random();
    return (
    <div className="app">
    This is the post page. We have {randomBananas} bananas 🍌!    
        <div>
        <div>
            <Title/>
            <InputSearchBar/>
            <TopRightButtons/>
        </div>
        <div>
            <StoryViewer/>
        </div>
        <div>
            <PostHeader posterPFP="https://image-cdn.hypb.st/https%3A%2F%2Fhypebeast.com%2Fimage%2F2021%2F10%2Fbored-ape-yacht-club-nft-3-4-million-record-sothebys-metaverse-1.jpg?w=1440&cbr=1&q=90&fit=max" posterUserName="Bossk" posterLocation="Trandosha"/>
            <PostMain/>
            <div className="post-buttons">
            <ButtonsLeft/>
            <ButtonsRight/>
            </div>
            <PosterRow/>
            <LikedBySection/>
        </div>
        <CommentSection commentSectionUsername="OGDOGE" commentSectionComment="This is a comment" commentSectionPFPURL="https://via.placeholder.com/150" />
        <CommentSection commentSectionUsername="JungleJim" commentSectionComment="This is a comment" commentSectionPFPURL="https://via.placeholder.com/150" />
        <CommentSection commentSectionUsername="TruffleShuffle" commentSectionComment="This is a comment" commentSectionPFPURL="https://via.placeholder.com/150" />
        </div>
    <div>
        <AddCommentButton/>
    </div>
    </div>
    )
}