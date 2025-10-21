export type Role = "master" | "guest";
export interface JwtUser {
  sub: string;
  role: Role;
}
