import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { AppError, ErrorCode } from "@/server/http/response";
import { registerSchema, type RegisterInput } from "@/server/validators/auth";
import { BCRYPT_COST } from "./config";

/**
 * Register a new user. Validation + hashing live here (domain/service layer),
 * never in a UI component. Email uniqueness is enforced at the DB level; we map
 * the race-safe unique violation to a friendly conflict error.
 */
export async function registerUser(input: RegisterInput) {
  const { name, email, password } = registerSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(ErrorCode.CONFLICT, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true },
  });

  return user;
}
