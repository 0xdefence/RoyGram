export type UserID = string;
export type PostID = string;
export type StoryID = string;
export type CommentID = string;

export interface User {
    userID: UserID;
    userName: string;
    emailaddress: string;
    age: number;
}

export interface Post {
    author: UserID;
    postID: PostID;
    postDescription: string;
    postLocation: string;
    postDate: string;
    likeCount: number;
    shareCount: number;
    saveCount: number;
    requires18Plus: boolean;
}

export interface Story {
    storyID: StoryID;
    author: UserID;
    postLocation: string;
    postDate: string;
    likeCount: number;
    shareCount: number;
    requires18Plus: boolean;
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
}

