import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GrpcCallLogsService } from './grpc-call-logs.service';
import { GrpcCallLog } from './entities/grpc-call-log.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Reflector } from '@nestjs/core';

@Resolver(() => GrpcCallLog)
@UseGuards(new JwtAuthGuard(new Reflector()), new RolesGuard(new Reflector()))
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
export class GrpcCallLogsResolver {
  constructor(private readonly grpcCallLogsService: GrpcCallLogsService) {}

  @Query(() => [GrpcCallLog])
  async grpcCallLogs(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
    @Args('status', { nullable: true }) status?: string,
  ): Promise<GrpcCallLog[]> {
    return this.grpcCallLogsService.findAll({ limit, offset, status });
  }

  @Query(() => Int)
  async grpcCallLogsCount(): Promise<number> {
    return this.grpcCallLogsService.countTotal();
  }
}
