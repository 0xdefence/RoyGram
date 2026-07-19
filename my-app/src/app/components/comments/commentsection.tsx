interface commentSectionProps {
    commentSectionUsername: string;
    commentSectionComment: string;
    commentSectionPFPURL: string;   
}

export function CommentSection(props: commentSectionProps) {
    const commentSectionUsername = props.commentSectionUsername;
    const commentSectionComment = props.commentSectionComment;
    const commentSectionPFPURL = props.commentSectionPFPURL;

    return (
<div className="comment-section-bundle">
    <div className="comment-header">
        </div>
        <div className="comment">
            <div className="individual-comment">
            <div className="username-logo">
                <img className="user-poster"
                src={commentSectionPFPURL}>
                </img>
            </div>
            <div className = "commentator">
                <div className = "poster-name">
                    <p>@{commentSectionUsername}</p>
                </div> 
                <div className="commentator-comment">
                <p>{commentSectionComment}</p>
                </div>
            </div>
        </div>
        </div>
    </div>
    )
}