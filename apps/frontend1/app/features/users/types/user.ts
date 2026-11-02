export interface UserSummary {
  id: string;
  name: string;
  image: string | null;
}

export interface Me {
  id: string;
  email?: string;
  name: string;
  image: string | null;
}
