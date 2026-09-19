import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Goal, Level } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toSafeUser, type SafeUser } from '../common/safe-user';

export interface UpdateProfileDto {
  name?: string;
  bio?: string;
  level?: Level;
  goal?: Goal;
  schedule?: string;
  gymId?: string;
  photoUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current-user profile for GET /users/me — never exposes passwordHash (Part 0). */
  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toSafeUser(user) : null;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser & { gym: { id: string; name: string; city: string } | null }> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    // Validate bio is non-empty if provided
    if (dto.bio !== undefined && dto.bio.trim() === '') {
      throw new BadRequestException('Bio cannot be empty');
    }

    // Validate gym exists if gymId provided
    if (dto.gymId) {
      const gym = await this.prisma.gym.findUnique({ where: { id: dto.gymId } });
      if (!gym) throw new NotFoundException('Gym not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.bio !== undefined && { bio: dto.bio.trim() || null }),
        ...(dto.level && { level: dto.level }),
        ...(dto.goal && { goal: dto.goal }),
        ...(dto.schedule !== undefined && { schedule: dto.schedule || null }),
        ...(dto.gymId !== undefined && { gymId: dto.gymId || null }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl || null }),
      },
      include: { gym: { select: { id: true, name: true, city: true } } },
    });

    return toSafeUser(user);
  }
}