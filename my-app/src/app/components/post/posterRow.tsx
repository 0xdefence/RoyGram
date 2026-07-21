import { postList } from "@/data/postList"
import { userList } from "@/data/userList";

export function PosterRow() {
    return (
      <div className="poster-row">
        <div className="poster">
          {postList.map((post) => {
            const user = userList.find(
              (user) => user.userID === post.author
            );
  
            return (
              <div className="poster-username-comment" key={post.postID}>
                <div className="doge-name">
                  <p>{user?.userName ?? "Unknown"}</p>
                </div>
  
                <div className="doge-comment">
                  <p>{post?.postDescription ?? "Unknown"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }