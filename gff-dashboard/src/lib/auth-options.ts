import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const db = getDb();
        const user = db
          .prepare("SELECT * FROM users WHERE username = ?")
          .get(credentials.username) as
          | { id: number; username: string; password_hash: string; role: string }
          | undefined;

        if (!user) return null;

        const valid = bcrypt.compareSync(
          credentials.password,
          user.password_hash,
        );
        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "dev-gff-dashboard-secret",
};
