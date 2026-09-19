import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReportDto } from './reports.controller';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.targetId === reporterId) {
      throw new BadRequestException('You cannot report yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: dto.targetId }, select: { id: true } });
    if (!target) throw new NotFoundException('Reported user not found');

    const report = await this.prisma.report.create({
      data: { reporterId, targetId: dto.targetId, reason: dto.reason, details: dto.details },
    });
    return { id: report.id, createdAt: report.createdAt };
  }
}
