import { postList } from "@/data/postList"
import { userList } from "@/data/userList";

interface PosterRowProps {
    userName: string;
    postDescription: string;
}

export function PosterRow(props: PosterRowProps) {
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
                  <p>{props.userName ?? "Unknown"}</p>
                </div>
  
                <div className="doge-comment">
                  <p>{props.postDescription ?? "Unknown"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }