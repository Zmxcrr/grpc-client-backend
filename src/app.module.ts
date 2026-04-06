import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { join } from 'path';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProtoModule } from './proto/proto.module';
import { GrpcExecutorModule } from './grpc-executor/grpc-executor.module';
import { SseModule } from './sse/sse.module';
import { EnvironmentsModule } from './environments/environments.module';
import { SavedRequestsModule } from './saved-requests/saved-requests.module';
import { CollectionsModule } from './collections/collections.module';
import { HistoryModule } from './history/history.module';
import { GrpcCallLogsModule } from './grpc-call-logs/grpc-call-logs.module';
import { CommonModule } from './common/common.module';

import { User } from './users/entities/user.entity';
import { ProtoSchema } from './proto/entities/proto-schema.entity';
import { Environment } from './environments/entities/environment.entity';
import { SavedRequest } from './saved-requests/entities/saved-request.entity';
import { RequestCollection } from './collections/entities/request-collection.entity';
import { RequestHistory } from './history/entities/request-history.entity';
import { GrpcCallLog } from './grpc-call-logs/entities/grpc-call-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
              const isProd = config.get<string>('NODE_ENV') === 'production';
              const databaseUrl = config.get<string>('DATABASE_URL');
              const dbSync =
                  config.get<string>('DB_SYNC', isProd ? 'false' : 'true') === 'true';

              return {
                  type: 'postgres',
                  ...(databaseUrl
                      ? {
                          url: databaseUrl,
                      }
                      : {
                          host: config.get<string>('DB_HOST', 'localhost'),
                          port: Number(config.get<string>('DB_PORT', '5432')),
                          username: config.get<string>('DB_USER', 'postgres'),
                          password: config.get<string>('DB_PASS', 'postgres'),
                          database: config.get<string>('DB_NAME', 'grpc_ide'),
                      }),
                  entities: [
                      User,
                      ProtoSchema,
                      Environment,
                      SavedRequest,
                      RequestCollection,
                      RequestHistory,
                      GrpcCallLog,
                  ],
                  synchronize: dbSync,
                  logging: !isProd,
              };
          },
      }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: config.get('NODE_ENV') !== 'production',
          introspection: true,
          context: ({ req, res }) => ({ req, res }),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    CacheModule.register({ isGlobal: true, ttl: 60000 }),
    CommonModule,
    AuthModule,
    UsersModule,
    ProtoModule,
    GrpcExecutorModule,
    SseModule,
    EnvironmentsModule,
    SavedRequestsModule,
    CollectionsModule,
    HistoryModule,
    GrpcCallLogsModule,
  ],
})
export class AppModule {}
