import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { RequestHistory } from './entities/request-history.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Reflector } from '@nestjs/core';

@Resolver(() => RequestHistory)
@UseGuards(new JwtAuthGuard(new Reflector()))
export class HistoryResolver {
  constructor(private readonly historyService: HistoryService) {}

  @Query(() => [RequestHistory])
  async requestHistory(
    @CurrentUser() user: User,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<RequestHistory[]> {
    return this.historyService.findAllByUser(user.id, limit);
  }

  @Mutation(() => Boolean)
  async clearHistory(@CurrentUser() user: User): Promise<boolean> {
    return this.historyService.clearUserHistory(user.id);
  }
}
