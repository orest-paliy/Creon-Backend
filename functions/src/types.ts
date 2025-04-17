export interface Comment {
    id: string;
    userId: string;
    text: string;
    createdAt: number;
    likedBy?: string[];
  }

export interface Post {
    id: string;
    authorId: string;
    title: string;
    description: string;
    imageUrl: string;
    isAIgenerated: boolean;
    aiConfidence: number;
    tags: string;
    embedding?: number[];
    comments?: Comment[];
    likesCount: number;
    likedBy?: string[];
    createdAt: number;
    updatedAt?: number;
  }

export interface UserProfileDTO {
    uid: string;
    email: string;
    interests: string[];
    embedding: number[];
    avatarURL: string;
    createdAt: number;
    subscriptions?: string[];
    followers?: string[];
}
