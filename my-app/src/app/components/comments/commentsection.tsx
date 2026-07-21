import { Comment } from "@/types/types";
import { commentList } from "@/data/commentList";
import { UserPFP } from "@/types/types";
import { userList } from "@/data/userList";

interface commentSectionProps {
    commentSectionUsername: Comment["author"];
    commentSectionComment: Comment["commentText"];
    commentSectionPFPURL: UserPFP;   
}

export function CommentSection(props: commentSectionProps) {
    const commentSectionComment = props.commentSectionComment;
    const commentSectionPFPURL = props.commentSectionPFPURL;

    return (
        <div className="comment">
        {commentList.map((comment) => {
                const user = userList.find((user) => user.userID === comment.author)
            return (
        <div className="individual-comment">
            <div className="username-logo">
                <img className="user-poster"
                src={commentSectionPFPURL}>
                </img>
            </div>
            <div className = "commentator">
                <div className = "poster-name">
                    <p>@{user?.userName ?? "Unknown"}</p>
                </div> 
                <div className="commentator-comment">
                <p>{commentSectionComment}</p>
                </div>
            </div>
        </div>
            );
        })}
    </div>
);
}