import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { GymsService } from './gyms.service';

@ApiTags('gyms')
@Controller('gyms')
export class GymsController {
  constructor(private readonly gyms: GymsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List gyms — nearest first when ?near=lat,lng is passed (story #6 onboarding step 3)',
  })
  @ApiQuery({ name: 'near', required: false, description: 'lat,lng from geolocation; sorts by distance' })
  @ApiQuery({ name: 'city', required: false, description: 'Case-insensitive city filter (manual fallback)' })
  list(@Query('near') near?: string, @Query('city') city?: string) {
    return this.gyms.list(near, city);
  }
}
