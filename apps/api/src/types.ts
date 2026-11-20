import type { Role } from '@itti/schemas';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role | string | null | undefined;
  twoFactorEnabled?: boolean | null;
};

export type AppEnv = {
  Variables: {
    user: SessionUser | null;
    sessionId: string | null;
  };
};
