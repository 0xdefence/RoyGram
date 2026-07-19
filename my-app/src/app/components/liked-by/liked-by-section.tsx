interface LikedByProps {
    likedByName: string;
    likedByNumber: number; 
    likedByIMGURL: string;
}

export function LikedBySection(props: LikedByProps) {
    const userName = props.likedByName;
    const likedNumber = props.likedByNumber; 
    const imgURL = props.likedByIMGURL;

    return (
    <div className="liked-by-section">
        <div className="liked-by-image">
           <img  
            className="liked-by-poster"
            src={imgURL}>
            </img>
        </div>
        <div className="liked-by-container">
            <div className="liked-by">
            <p>Liked by</p>
            </div>
             <div className="liked-by-username">
            {userName}
            </div>
            <div className="and">
            <p>and</p>
            </div>
            <div className="liked-by-number">
            <p>{likedNumber} others</p>
            </div>
        </div>
    </div>
    )
}