import { ConflictException, Injectable } from '@nestjs/common';
import type { AuthUser, UserRole, UserSummary } from '@harmonylens/shared';
import { hashPassword } from '../auth/password.js';
import { DatabaseService } from '../db/database.service.js';
import { PG_UNIQUE_VIOLATION, isPgError } from '../db/pg-errors.js';
import type { RegisterDto } from './user.schemas.js';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
}

const toAuthUser = (r: UserRow): AuthUser => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  role: r.role,
});

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: RegisterDto): Promise<AuthUser> {
    const passwordHash = await hashPassword(dto.password);
    try {
      const row = await this.db.one<UserRow>(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, email, role, is_active, created_at`,
        [dto.fullName, dto.email, passwordHash, dto.role],
      );
      return toAuthUser(row!);
    } catch (error) {
      if (isPgError(error) && error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Ya existe un usuario con ese correo',
          errors: { email: 'Ya existe un usuario con ese correo' },
        });
      }
      throw error;
    }
  }

  async list(): Promise<UserSummary[]> {
    const rows = await this.db.query<UserRow>(
      `SELECT id, full_name, email, role, is_active, created_at
       FROM users ORDER BY created_at DESC, full_name`,
    );
    return rows.map((r) => ({
      ...toAuthUser(r),
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
