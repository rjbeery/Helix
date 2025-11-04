export type Role = "admin" | "user";
export interface JwtUser {
  sub: string;
  role: Role;
}
