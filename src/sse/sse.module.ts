import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { GrpcExecutorModule } from '../grpc-executor/grpc-executor.module';
import { GrpcCallLogsModule } from '../grpc-call-logs/grpc-call-logs.module';

@Module({
  imports: [GrpcExecutorModule, GrpcCallLogsModule],
  controllers: [SseController],
})
export class SseModule {}
