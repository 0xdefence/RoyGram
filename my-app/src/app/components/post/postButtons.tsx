// we add this in for react webhooks!
"use client";

// use effect = react to change + use state = remember change data!
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faComment, faPaperPlane, faBookmark } from "@fortawesome/free-solid-svg-icons";

// total hardcoded inside, we will add totallikes another time.

interface ButtonsLeftProps {
    // for likes 
    isLiked: boolean;
    displayedLikeCount: number;
    // this prop returns nothing
    onLikeClick: () => void;
    
    // for comments 
    commentsDisplay: boolean;
    isCommentDisplayed: boolean;
    onCommentClick: () => void;
}

interface ButtonsRightProps {
    // for saves
    isSaved: boolean;
    onSaveClick: () => void; 
    displayedSaveCount: number;
}


export function ButtonsLeft(props: ButtonsLeftProps) {
    return (
    <div className ="buttons">
        <FontAwesomeIcon 
        icon={faHeart} 
        onClick={props.onLikeClick}
        className={props.isLiked? "heart-liked" : "heart-unliked"}
        />
        <FontAwesomeIcon 
        icon={faComment} 
        onClick={props.onCommentClick}
        className={props.commentsDisplay? "comment-display" : "comment-nodisplay"}
        />
        <FontAwesomeIcon icon={faPaperPlane} />
        </div>
    )
}

export function ButtonsRight(props: ButtonsRightProps) {
    return (
    <div className="save-button">
        <FontAwesomeIcon 
        icon={faBookmark}
        onClick={props.onSaveClick}
        className={props.isSaved? "saved-yes" : "saved-no"}
        />
    </div>
    )
}