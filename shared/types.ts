export type Role = "medico" | "admin";

export interface AuthUser {
  type: "staff";
  id: number;
  openId: string;
  nome: string | null;
  email: string | null;
  role: Role;
}
