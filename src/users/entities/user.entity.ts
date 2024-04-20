import { ApiProperty } from '@nestjs/swagger';
import { string } from '@hapi/joi';
import { IsUUID } from 'class-validator';
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '@unifygpt.ai/utilities';

@Entity()
export class UserEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    type: string,
    description: 'Identify Id of this record',
    example: 'df795f2f-c034-4b67-a1c2-87d49f7a5034',
  })
  @IsUUID()
  public id: string;
}
