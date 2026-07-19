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
    const userPFP = props.userPFP;

    return (
    <div>
    <img className="individual-pfp"
        src={userPFP}/>
        <div className="individual-nametag">
            {userName}
        </div>
        <div className="individual-location">
            {userLocation}
        </div>
    </div>
    )
}

