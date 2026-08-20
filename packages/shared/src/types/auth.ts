export interface AuthUserDTO {
  id: string;
  email: string;
  createdAt: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUserDTO;
  accessToken: string;
  /** Seconds until the access token expires, for client-side refresh scheduling. */
  expiresIn: number;
}
