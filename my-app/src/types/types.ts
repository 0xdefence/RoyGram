// UserPFP is a reusable type alias for profile image URLs.
// comment.userPFP stores the profile image used for that comment.
// comment.author stores the user ID, which I resolve through userList.find() to get the display name.

export type UserID = string;
export type PostID = string;
export type StoryID = string;
export type CommentID = string;
export type UserPFP = string;
export type species = "alien" | "droid" | "human";

export interface User {
    userID: UserID;
    userName: string;
    emailaddress: string;
    age: number;
    userPFP: UserPFP;
    species: species;
}

export interface Post {
    author: UserID;
    postID: PostID;
    postURL: string;
    postDescription: string;
    postLocation: string;
    postDate: string;
    likeCount: number;
    shareCount: number;
    saveCount: number;
    requires18Plus: boolean;
    userPFP: UserPFP;
    species: species;
}

export interface Story {
    storyID: StoryID;
    author: UserID;
    postLocation: string;
    postDate: string;
    likeCount: number;
    shareCount: number;
    requires18Plus: boolean;
    userPFP: UserPFP;
    species: species;
}

export interface Comment {
    commentID: CommentID;
    postID: PostID
    author: UserID;
    commentText: string;
    postDate: string;
    likeCount: number;
    replyCount: number;
    gifURL?: string;
    userPFP: UserPFP;
    species: species;
}

