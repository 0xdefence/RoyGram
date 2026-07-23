// we add this in for react webhooks!
"use client";

// use effect = react to change + use state = remember change data!
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faComment, faPaperPlane, faBookmark } from "@fortawesome/free-solid-svg-icons";

// total hardcoded inside, we will add totallikes another time.

interface ButtonsLeftProps {
    isLiked: boolean;
    displayedLikeCount: number;
    // this prop returns nothing
    onLikeClick: () => void;
}


export function ButtonsLeft(props: ButtonsLeftProps) {
    return (
    <div className ="buttons">
        <FontAwesomeIcon 
        icon={faHeart} 
        onClick={props.onLikeClick}
        className={props.isLiked? "heart-liked" : "heart-unliked"}
        />

        <p>{props.displayedLikeCount}</p>

        <FontAwesomeIcon icon={faComment} />
        <FontAwesomeIcon icon={faPaperPlane} />
        </div>
    )
}

export function ButtonsRight() {
    return (
    <div className="save-button">
        <FontAwesomeIcon icon={faBookmark} />
    </div>
    )
}