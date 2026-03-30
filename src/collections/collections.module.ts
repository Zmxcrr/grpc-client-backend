import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestCollection } from './entities/request-collection.entity';
import { CollectionsService } from './collections.service';
import { CollectionsResolver } from './collections.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([RequestCollection])],
  providers: [CollectionsService, CollectionsResolver],
  exports: [CollectionsService],
})
export class CollectionsModule {}
