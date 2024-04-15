import { ApiProperty } from '@nestjs/swagger';
import { string } from '@hapi/joi';
import { IsOptional, MaxLength } from 'class-validator';
import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class BaseEntity {
  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt?: Date;

  @Column({ length: 50, nullable: true })
  @ApiProperty({
    type: string,
    example: 'df795f2f-c034-4b67-a1c2-87d49f7a5034',
  })
  @IsOptional()
  @MaxLength(50)
  public createdBy?: string;

  @Column({ length: 50, nullable: true })
  @ApiProperty({
    type: string,
    example: 'df795f2f-c034-4b67-a1c2-87d49f7a5034',
  })
  @IsOptional()
  @MaxLength(50)
  public updatedBy?: string;
}
