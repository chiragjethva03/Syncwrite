import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { loginSchema } from "@/server/validators/auth";
import { notifyNewSignup } from "@/server/services/notify.service";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Strategy: **Credentials + Google OAuth, on stateless JWT sessions**.
 *  - Credentials lets us own the register/login UX end-to-end (a requirement).
 *  - Google OAuth is added via the PrismaAdapter, which persists OAuth users +
 *    their linked `Account` row automatically (no hand-rolled upsert). We still
 *    keep the JWT session strategy (not database sessions) so Credentials works
 *    and we avoid a DB round-trip per request — the adapter only handles the
 *    OAuth account persistence, not the session transport.
 *  - JWT sessions avoid a DB round-trip on every request and work cleanly on
 *    serverless/edge — a good fit for Vercel. The signed token carries only the
 *    user id + minimal profile; authorization is always re-checked against the
 *    DB in the service layer (never trust the token for row access).
 *  - Passwords are hashed with bcrypt (cost 12). We compare in constant time.
 *
 * Route protection is enforced server-side in layouts + services (see
 * auth/session.ts and services/*), NOT in proxy/middleware — the Next.js docs
 * explicitly advise against using proxy as the authorization boundary.
 */

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const BCRYPT_COST = 12;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Link a Google login to an existing account with the same email. Safe
      // here because Google verifies email ownership; it lets a user who first
      // registered with credentials later sign in with Google seamlessly.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        // Always run a bcrypt compare to avoid a user-enumeration timing oracle.
        const hash =
          user?.passwordHash ??
          "$2a$12$0000000000000000000000000000000000000000000000000000u";
        const valid = await bcrypt.compare(password, hash);
        if (!user || !user.passwordHash || !valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    // Fires when the adapter creates a brand-new user (i.e. first Google sign-in).
    // Credentials signups are notified separately in auth/register.ts.
    async createUser({ user }) {
      await notifyNewSignup({ name: user.name, email: user.email }, "google");
    },
  },
});
