// we will be using props, or property: vars we define from a 
// top level! 

interface IndividualStoryProps {
    userPFP: string;
    userName: string; 
    userLocation: string;
}

export default function IndividualStory(props: IndividualStoryProps) {
    const userName = props.userName;
    const userLocation = props.userLocation;

    return (
    <div>
    <img className="individual-pfp"
            src="https://fastly.picsum.photos/id/237/536/354.jpg?hmac=i0yVXW1ORpyCZpQ-CknuyV-jbtU7_x9EBQVhvT5aRr0"></img>
        <div className="individual-nametag">
            {userName}
        </div>
        <div className="individual-location">
            {userLocation}
        </div>
    </div>
    )
}

