interface PosterProps {
    posterPFP: string;
    posterUserName: string;
    posterLocation: string;
}

// story viewer top level

export default function PostHeader(props: PosterProps) {
    const PosterPropsPFP = props.posterPFP;
    const PosterPropsUsername = props.posterUserName;
    const PosterPropsLocations = props.posterLocation;

    return (
        <div className="posting-header">
            <img className="user-poster"
            src={props.posterLocation}></img>
            <div className="poster-ig-name">
                <div className="poster-ig-username">
                <p>{props.posterPFP}</p>
                </div>
                <div className="poster-location">
                <p>{props.posterLocation}</p>
                </div>
            </div>
        </div>
    )
}