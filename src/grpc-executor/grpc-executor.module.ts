import { Module } from '@nestjs/common';
import { GrpcExecutorController } from './grpc-executor.controller';
import { GrpcExecutorService } from './grpc-executor.service';
import { ProtoModule } from '../proto/proto.module';
import { HistoryModule } from '../history/history.module';
import { GrpcCallLogsModule } from '../grpc-call-logs/grpc-call-logs.module';

@Module({
  imports: [ProtoModule, HistoryModule, GrpcCallLogsModule],
  controllers: [GrpcExecutorController],
  providers: [GrpcExecutorService],
  exports: [GrpcExecutorService],
})
export class GrpcExecutorModule {}
