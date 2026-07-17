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
    postedDate: string;
    author: User; 
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
    author: User; 
    caption?: string; // text on image
    location?: string;
    storyMusic?: string;
    storyFilter?: string;
    likeCount: number; 
    shareCount: number; // stories can be shared
}

export interface Comment {
    commentImageURL: string;
    postedDate: string;
    author: User; 
    caption: string;
    likeCount: number; 
    commentCount: number;
    GIFURL?: string;
}