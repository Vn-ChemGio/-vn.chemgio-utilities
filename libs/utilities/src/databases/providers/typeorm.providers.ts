import { REQUEST } from '@nestjs/core';
import { Provider } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  DataSourceOptions,
  DeepPartial,
  FindOptionsWhere,
  getMetadataArgsStorage,
  ObjectId,
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
    const result = repository.create(
      createData.map((item) => ({
        ...item,
        createdBy: request.user?.id,
      })),
    );

    return this.repository.save(result);
  },


  update(criteria: string | string[] | number | number[] | Date | Date[] | ObjectId | ObjectId[] | FindOptionsWhere<T>, updateDatabaseDto: QueryDeepPartialEntity<T>) {
    return repository.update(criteria, {
      ...updateDatabaseDto,
      updatedBy: request.user?.id,
    });
  },

  upsert(
    entityOrEntities: QueryDeepPartialEntity<T>,
    conflictPathsOrOptions: string[] | UpsertOptions<T>,
  ) {
    return repository.upsert(
      {
        ...entityOrEntities,
        createdBy: request.user?.id,
        updatedBy: request.user?.id,
      },
      conflictPathsOrOptions,
    );
  },
});
