// this is how we define react files 
// we are using named exports where we use the variable is tied to how we would import it
// we'd give a name 
// a DEFAULT export means the DEFAULT of the file wrote the code in, either 0 or 1
// it doesn't need to be the same name. you have a 1-1 
// react must ALWAYS Start with capital! 
// TODO: Persist saved state and save count to the database once backend storage is introduced.

"use client";

import { useState } from "react";
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
import { postList } from "@/data/postList";
import { userList } from "@/data/userList";

export default function SecondHome() {
    const [isLiked, setIsLiked] = useState(false);
    const startingLikeCount = 324;
    const displayedLikeCount = isLiked ? startingLikeCount + 1 : startingLikeCount; 

    const [isSaved, setIsSaved] = useState(false);
    const startingSaveCount = postList[0].saveCount;
    const displayedSaveCount = isSaved ? startingSaveCount + 1 : startingSaveCount; 

    const [CommentDisplayed, setCommentDisplayed] = useState(true);

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
                    <PostMain postURL={postList[0].postURL}/>
                    <div className="buttons">
                        <ButtonsLeft 
                        isLiked={isLiked}
                        displayedLikeCount={displayedLikeCount}
                        onLikeClick={() => setIsLiked(!isLiked)}
                        onCommentClick={() => setCommentDisplayed(!CommentDisplayed)
                        }
                    />
                        <ButtonsRight 
                        isSaved={isSaved}
                        displayedSaveCount={displayedSaveCount}
                        onSaveClick={() => setIsSaved(!isSaved)}
                        />
                    </div>
                    <div>
                        <LikedBySection likedByName="Dengar" likedByIMGURL="https://via.placeholder.com/150" likedByNumber={displayedLikeCount} />
                    </div>
                    <div>
                        <PosterRow userName={userList[0].userName} postDescription={postList[0].postDescription}/>
                    </div>

                    <div className="comment-section-bundle">
                        <CommentSectionTitle />
                        {CommentDisplayed && ( // use {booleanValue && ()} for conditional react displays
                        <div className="comment">
                            <CommentSection />
                        </div>
                        )}
                        <div>
                            <AddCommentButton />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
