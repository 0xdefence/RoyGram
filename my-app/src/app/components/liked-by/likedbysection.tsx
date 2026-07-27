interface LikedByProps {
    likedByName: string;
    likedByNumber: number; 
    likedByIMGURL: string;
}

export function LikedBySection(props: LikedByProps) {
    return (
    <div className="liked-by-section">
        <div className="liked-by-image">
           <img
            className="liked-by-poster"
            src={props.likedByIMGURL}
            />
        </div>
        <div className="liked-by-container">
            <div className="liked-by">
            <p>Liked by</p>
            </div>
             <div className="liked-by-username">
            <p>{props.likedByName}</p>
            </div>
            <div className="and">
            <p>and</p>
            </div>
            <div className="liked-by-number">
            <p>{props.likedByNumber} others</p>
            </div>
        </div>
    </div>
    )
}
