import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faComment, faPaperPlane, faBookmark } from "@fortawesome/free-solid-svg-icons";

export function ButtonsLeft() {
    return (
    <div className ="buttons">
        <FontAwesomeIcon icon={faHeart} />
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