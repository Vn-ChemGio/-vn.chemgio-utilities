import { Inject } from '@nestjs/common';
import { getDataSourceToken, getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { EntityClassOrSchema } from '../interfaces';
import { DEFAULT_DATA_SOURCE_NAME } from '../typeorm.constants';

export const InjectRepository = (
  entity: EntityClassOrSchema,
  dataSource: string = DEFAULT_DATA_SOURCE_NAME,
): ReturnType<typeof Inject> => Inject(getRepositoryToken(entity, dataSource));

export const InjectDataSource: (
  dataSource?: DataSource | DataSourceOptions | string,
) => ReturnType<typeof Inject> = (
  dataSource?: DataSource | DataSourceOptions | string,
) => Inject(getDataSourceToken(dataSource));

export const InjectEntityManager: (
  dataSource?: DataSource | DataSourceOptions | string,
) => ReturnType<typeof Inject> = (
  dataSource?: DataSource | DataSourceOptions | string,
) => Inject(getEntityManagerToken(dataSource));
