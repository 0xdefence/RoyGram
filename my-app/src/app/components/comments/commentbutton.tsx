import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment } from "@fortawesome/free-solid-svg-icons";

export function AddCommentButton() {
    return (
    <div>
    <FontAwesomeIcon icon={faComment} />
    <p>Add your own comment button</p>
    </div>
    )
}