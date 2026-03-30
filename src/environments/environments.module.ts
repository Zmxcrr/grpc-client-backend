import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Environment } from './entities/environment.entity';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsResolver } from './environments.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Environment])],
  providers: [EnvironmentsService, EnvironmentsResolver],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
