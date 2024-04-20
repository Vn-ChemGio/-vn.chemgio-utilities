import { REQUEST } from '@nestjs/core';
import { Provider } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  DataSourceOptions,
  DeepPartial,
  FindOneOptions,
  FindOptionsWhereProperty,
  getMetadataArgsStorage,
  Repository,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { EntityClassOrSchema } from '../interfaces';
import { BaseEntity } from '../entities';

export function createTypeOrmProviders(
  entities?: EntityClassOrSchema[],
  dataSource?: DataSource | DataSourceOptions | string,
): Provider[] {
  return (entities || []).map((entity) => ({
    imports: [REQUEST],
    provide: getRepositoryToken(entity, dataSource),
    useFactory: (dataSource: DataSource, request: Request) => {
      const entityMetadata = dataSource.entityMetadatas.find(
        (meta) => meta.target === entity,
      );
      const isTreeEntity = typeof entityMetadata?.treeType !== 'undefined';
      return getCustomRepository(
        isTreeEntity
          ? dataSource.getTreeRepository(entity)
          : dataSource.options.type === 'mongodb'
            ? dataSource.getMongoRepository(entity)
            : dataSource.getRepository(entity),
        request,
      );
    },
    inject: [getDataSourceToken(dataSource), REQUEST],
    /**
     * Extra property to workaround dynamic modules serialisation issue
     * that occurs when "TypeOrm#forFeature()" method is called with the same number
     * of arguments and all entities share the same class names.
     */
    targetEntitySchema: getMetadataArgsStorage().tables.find(
      (item) => item.target === entity,
    ),
  }));
}

const getCustomRepository = <T extends BaseEntity & { id: string | number } = BaseEntity & { id: string }>(
  repository: Repository<T>,
  request: Request,
) => Object.assign(Object.create(repository), {
  ...repository,
  create: (createData: DeepPartial<T>) =>
    repository.create({
      ...createData,
      createdBy: request.user?.id,
    }),

  createMany(createData: DeepPartial<T>[]) {
    const result = this.repository.create(
      createData.map((item) => ({
        ...item,
        createdBy: request.user?.id,
      })),
    );

    return this.repository.save(result);
  },

  findById(
    id: FindOptionsWhereProperty<T['id'], T['id']>,
    options?: FindOneOptions<T>,
  ) {
    return this.findOne({
      ...options,
      where: { id },
    } as FindOneOptions<T>);
  },

  findByIdOrFail(
    id: FindOptionsWhereProperty<T['id'], T['id']>,
    options?: FindOneOptions<T>,
  ) {
    return this.findOneOrFail({
      ...options,
      where: { id },
    } as FindOneOptions<T>);
  },

  updateById(id: T['id'], updateDatabaseDto: QueryDeepPartialEntity<T>) {
    return this.repository.update(id, {
      ...updateDatabaseDto,
      updatedBy: request.user?.id,
    });
  },

  upsert(
    entityOrEntities: QueryDeepPartialEntity<T>,
    conflictPathsOrOptions: string[] | UpsertOptions<T>,
  ) {
    return this.repository.upsert(
      {
        ...entityOrEntities,
        createdBy: request.user?.id,
        updatedBy: request.user?.id,
      },
      conflictPathsOrOptions,
    );
  },
});
