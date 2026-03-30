import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedRequest } from './entities/saved-request.entity';
import { SavedRequestsService } from './saved-requests.service';
import { SavedRequestsResolver } from './saved-requests.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([SavedRequest])],
  providers: [SavedRequestsService, SavedRequestsResolver],
  exports: [SavedRequestsService],
})
export class SavedRequestsModule {}
