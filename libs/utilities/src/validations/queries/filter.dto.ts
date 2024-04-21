import { ApiProperty } from '@nestjs/swagger';
import { date, number, object, string } from '@hapi/joi';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

enum EnumA {
  DESC = 'DESC',
  'ASC' = 'ASC',
}

export class OrderDto {
  @ApiProperty({
    type: string,
    description: 'Search field',
    example: { createdAt: 'DESC' },
  })
  @IsEnum(EnumA)
  public createdAt: 'DESC' | 'ASC';
}

export class FilterDto {
  @ApiProperty({
    type: string,
    description: 'Identify Id record',
    example: 'df795f2f-c034-4b67-a1c2-87d49f7a5034',
  })
  @IsOptional()
  @IsUUID()
  public id?: string;

  @ApiProperty({
    type: string,
    description: 'Identify Id of organization',
    example: 'org_dFx7oiL9n1UeFvi5',
  })
  @IsOptional()
  @IsString()
  public organizationId?: string;

  @ApiProperty({
    type: number,
    description: 'Filter condition',
    example: { name: 'abc' },
  })
  @IsOptional()
  @IsObject()
  public where?: object;

  @ApiProperty({
    type: object,
    description: 'Order direction',
    example: { createdAt: 'DESC' },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderDto)
  public order?: OrderDto;

  @ApiProperty({
    type: number,
    description: 'Number items will be ignore on pagination',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  public skip?: number;

  @ApiProperty({
    type: number,
    description: 'Number items will be retrieve on pagination',
    example: { createdAt: 'DESC' },
  })
  @IsOptional()
  @IsInt()
  public take?: number;

  @ApiProperty({
    type: date,
    description: 'Start RangeTime create',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDateString()
  public fromTime?: string;

  @ApiProperty({
    type: date,
    description: 'End RangeTime create',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDateString()
  public toTime?: string;

  @ApiProperty({
    type: date,
    description: 'Start RangeTime updated',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDateString()
  public updatedFromTime?: string;

  @ApiProperty({
    type: date,
    description: 'End RangeTime updated',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDateString()
  public updatedToTime?: string;

  @ApiProperty({
    type: date,
    description: 'End RangeTime updated',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsString({ each: true })
  public relations?: string[];
}
