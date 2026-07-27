interface PosterProps {
    posterPFP: string;
    posterUserName: string;
    posterLocation: string;
}

// story viewer top level

export default function PostHeader(props: PosterProps) {
    return (
        <div className="posting-header">
            <img className="user-poster"
            src={props.posterPFP}
            alt={`${props.posterUserName} profile`}
            />
            <div className="poster-ig-name">
                <div className="poster-ig-username">
                <p>{props.posterUserName}</p>
                </div>
                <div className="poster-location">
                <p>{props.posterLocation}</p>
                </div>
            </div>
        </div>
    )
}
