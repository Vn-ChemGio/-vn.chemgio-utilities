import { Injectable } from '@nestjs/common';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhereProperty,
  Repository,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { BaseEntity } from '../entities';

@Injectable()
export class DatabasesService<
  T extends BaseEntity & { id: string | number } = BaseEntity & { id: string },
> {
  protected repository: Repository<T>;
  protected request: Request;

  constructor(
    protected repositoryImported: Repository<T>,
    protected requestImported: Request,
  ) {
    this.repository = repositoryImported;
    this.request = requestImported;
  }

  create(createData: DeepPartial<T>) {
    return this.repository.save(
      this.repository.create({
        ...createData,
        createdBy: this.request.user?.id,
      }),
    );
  }

  createMany(createData: DeepPartial<T>[]) {
    const result = this.repository.create(
      createData.map((item) => ({
        ...item,
        createdBy: this.request.user?.id,
      })),
    );

    return this.repository.save(result);
  }

  findAll(options?: FindManyOptions<T>) {
    return this.repository.find(options);
  }

  findOne(options?: FindOneOptions<T>) {
    return this.repository.findOne({
      ...options,
    });
  }

  findOneOrFail(options?: FindOneOptions<T>) {
    return this.repository.findOneOrFail({
      ...options,
    });
  }

  findById(
    id: FindOptionsWhereProperty<T['id'], T['id']>,
    options?: FindOneOptions<T>,
  ) {
    return this.findOne({
      ...options,
      where: { id },
    } as FindOneOptions<T>);
  }

  findByIdOrFail(
    id: FindOptionsWhereProperty<T['id'], T['id']>,
    options?: FindOneOptions<T>,
  ) {
    return this.findOneOrFail({
      ...options,
      where: { id },
    } as FindOneOptions<T>);
  }

  updateById(id: T['id'], updateDatabaseDto: QueryDeepPartialEntity<T>) {
    return this.repository.update(id, {
      ...updateDatabaseDto,
      updatedBy: this.request.user?.id,
    });
  }

  upsert(
    entityOrEntities: QueryDeepPartialEntity<T>,
    conflictPathsOrOptions: string[] | UpsertOptions<T>,
  ) {
    return this.repository.upsert(
      {
        ...entityOrEntities,
        createdBy: this.request.user?.id,
        updatedBy: this.request.user?.id,
      },
      conflictPathsOrOptions,
    );
  }

  delete(id: T['id']) {
    return this.repository.delete(id);
  }

  softDelete(id: T['id']) {
    return this.repository.softDelete(id);
  }
}
