import { commentList } from "@/data/commentList";
import { userList } from "@/data/userList";
import { SpeciesFilter } from "./commentspeciesfilter";

interface CommentSectionProps {
    selectedFilter: SpeciesFilter;
}

export function CommentSection(props: CommentSectionProps) {
    const visibleComments = commentList.filter((comment) => {
        const user = userList.find((user) => user.userID === comment.author);
    
    if (props.selectedFilter === "all") {
        return true;
    }
    
    return user?.species === props.selectedFilter;
    });

    return (
        <div className="comment">            
        {visibleComments.map((comment) => {
                const user = userList.find((user) => user.userID === comment.author)
            return (
        <div className="individual-comment">
            <div className="username-logo">
                <img className="user-poster"
                src={user?.userPFP}>
                </img>
            </div>
            <div className = "commentator">
                <div className = "poster-name">
                    <p>@{user?.userName ?? "Unknown"}</p>
                </div> 
                <div className="commentator-comment">
                <p>{comment?.commentText}</p>
                </div>
            </div>
        </div>
            );
        })}
    </div>
);}