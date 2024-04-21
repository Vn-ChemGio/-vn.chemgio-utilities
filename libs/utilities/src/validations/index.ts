import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { FilterDto } from './queries';

export class QueryDto {
  @ApiProperty({
    type: FilterDto,
    description: 'Filter condition',
    example: {
      id: '',
      skip: 0,
      take: 10,
      order: { createdAt: 'DESC' },
      search: '',
      organizationId: '',
      where: {},
      fromTime: '2024-01-01T00:00:02.999Z',
      toTime: '2026-12-12T02:10:02.187Z',
    },
  })
  @IsOptional()
  @ValidateNested()
  @Transform(({ value }) => plainToInstance(FilterDto, JSON.parse(value)))
  @IsObject()
  @Type(() => FilterDto)
  public filter: FilterDto;
}
