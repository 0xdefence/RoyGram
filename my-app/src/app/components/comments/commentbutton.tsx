import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment } from "@fortawesome/free-solid-svg-icons";

export function AddCommentButton() {
    return (
    <div className="add-comment">
    <div>
        <FontAwesomeIcon icon={faComment}/>
    </div>
    <div>
        <p>Add your own comment button</p>
    </div>
    </div>
    )
}