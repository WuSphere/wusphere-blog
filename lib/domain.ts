export type UserRole = "admin" | "member" | "vip";

export type UserProfile = {
  id: string;
  email: string;
  level: number;
  exp: number;
  role: UserRole;
  avatar: string | null;
  bio: string | null;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  min_level: number;
  is_public: boolean;
  tags: string[] | null;
  attachments: string[] | null;
  author_id: string | null;
  created_at: string;
};
