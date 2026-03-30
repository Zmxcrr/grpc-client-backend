import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProtoSchema } from './entities/proto-schema.entity';
import { ProtoService } from './proto.service';
import { ProtoController } from './proto.controller';
import { ProtoResolver } from './proto.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([ProtoSchema])],
  providers: [ProtoService, ProtoResolver],
  controllers: [ProtoController],
  exports: [ProtoService],
})
export class ProtoModule {}
