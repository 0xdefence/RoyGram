import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faHeart, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

export function TopRightButtons() {
    return (
    <div className ="buttons-on-top">
        <FontAwesomeIcon icon={faImage} />
        <FontAwesomeIcon icon={faHeart} />
        <FontAwesomeIcon icon={faPaperPlane} />
    </div>
    )
}