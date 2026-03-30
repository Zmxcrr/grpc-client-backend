import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestHistory } from './entities/request-history.entity';
import { HistoryService } from './history.service';
import { HistoryResolver } from './history.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([RequestHistory])],
  providers: [HistoryService, HistoryResolver],
  exports: [HistoryService],
})
export class HistoryModule {}
