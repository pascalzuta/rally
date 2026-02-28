export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}
