import { commentList } from "@/data/commentList";
import { userList } from "@/data/userList";
import { SpeciesFilter } from "./commentspeciesfilter";
import { useMemo } from "react";

interface CommentSectionProps {
    selectedFilter: SpeciesFilter;
}

// O(u), built only once, so O(1) for each lookup. This is a good pattern to use when you need to look up data by ID frequently.

export function CommentSection(props: CommentSectionProps) {
    const userByID = useMemo(() => new Map(userList.map((u) => [u.userID, u])), []);

    const visibleComments = useMemo(() => {
        return commentList.filter((comment) => {
            if (props.selectedFilter === "all") return true;
            return userByID.get(comment.author)?.species === props.selectedFilter;
        });
    }, [props.selectedFilter, userByID]);

    return (
        <div className="comment">
            {visibleComments.map((comment) => {
                const user = userByID.get(comment.author);
                return (
                    <div className="individual-comment" key={comment.commentID}>
                        <div className="username-logo">
                            <img className="user-poster"
                                src={user?.userPFP}>
                            </img>
                        </div>
                        <div className="commentator">
                            <div className="poster-name">
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
    );
}