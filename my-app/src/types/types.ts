export type postImageID = String;
export type UserID = string;

export interface User {
    username: string;
    emailaddress: string;
    userId: string;
    age: number;
    followerCount: number;
    followingCount: number; 
    profileimageURL: string;
    isAgeVerified: boolean;
}

export interface Post {
    postImageUrl: string;
    postImageID: postImageID;
    postedDate: string;
    author: string; 
    userId: UserID;
    caption: string;
    location: string;
    likeCount: number;
    shareCount: number; 
    saveCount: number;
    requires18Plus: boolean;
}

export interface Story {
    storyImageUrl: string;
    postedDate: string; // 24h after, story should disappear!
    author: UserID; 
    caption?: string; // text on image
    location?: string;
    storyMusic?: string;
    storyFilter?: string;
    likeCount: number; 
    shareCount: number; // stories can be shared
}

export interface Comment {
    imageID: string;
    postImageID: postImageID;
    commentImageURL: string;
    postedDate: string;
    author: UserID; 
    commentText: string;
    likeCount: number; 
    replyCount: number;
    GIFURL?: string;
}