import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GymListItem {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  /** Present only when ?near= was provided. km, rounded to 0.1 */
  distanceKm?: number;
}

@Injectable()
export class GymsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(near?: string, city?: string): Promise<GymListItem[]> {
    const gyms = await this.prisma.gym.findMany({
      where: city ? { city: { contains: city, mode: 'insensitive' } } : undefined,
    });

    if (!near) {
      return gyms
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ id: g.id, name: g.name, city: g.city, lat: g.lat, lng: g.lng }));
    }

    const [lat, lng] = this.parseNear(near);
    return gyms
      .map((gym) => ({ gym, distanceKm: haversineKm(lat, lng, gym.lat, gym.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map(({ gym, distanceKm }) => ({
        id: gym.id,
        name: gym.name,
        city: gym.city,
        lat: gym.lat,
        lng: gym.lng,
        distanceKm: Math.round(distanceKm * 10) / 10,
      }));
  }

  private parseNear(near: string): [number, number] {
    const match = /^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$/.exec(near.trim());
    if (!match) throw new BadRequestException('near must be "lat,lng"');
    const lat = Number(match[1]);
    const lng = Number(match[3]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new BadRequestException('near coordinates out of range');
    return [lat, lng];
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
