interface PosterRowProps {
    userName: string;
    postDescription: string;
  }
  
  export function PosterRow(props: PosterRowProps) {
    return (
      <div className="poster-row">
        <div className="poster">
          <div className="poster-username-comment">
            <div className="doge-name">
              <p>{props.userName ?? "Unknown"}</p>
            </div>
  
            <div className="doge-comment">
              <p>{props.postDescription ?? "Unknown"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }