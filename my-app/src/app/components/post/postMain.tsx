interface PostMainProps {
    postURL: string;
  }

export function PostMain(props: PostMainProps) {
    return (<img
    className="posted-image"
    src={props.postURL}/>
    )
}