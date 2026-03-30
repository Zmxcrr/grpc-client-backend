import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { Environment } from './entities/environment.entity';
import { CreateEnvironmentInput } from './dto/create-environment.input';
import { UpdateEnvironmentInput } from './dto/update-environment.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Reflector } from '@nestjs/core';

@Resolver(() => Environment)
@UseGuards(new JwtAuthGuard(new Reflector()))
export class EnvironmentsResolver {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Query(() => [Environment])
  async environments(@CurrentUser() user: User): Promise<Environment[]> {
    return this.environmentsService.findAllByUser(user.id);
  }

  @Query(() => Environment)
  async environment(@Args('id', { type: () => ID }) id: string, @CurrentUser() user: User): Promise<Environment> {
    return this.environmentsService.findById(id, user.id);
  }

  @Mutation(() => Environment)
  async createEnvironment(
    @Args('input') input: CreateEnvironmentInput,
    @CurrentUser() user: User,
  ): Promise<Environment> {
    return this.environmentsService.create(input, user.id);
  }

  @Mutation(() => Environment)
  async updateEnvironment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEnvironmentInput,
    @CurrentUser() user: User,
  ): Promise<Environment> {
    return this.environmentsService.update(id, input, user.id);
  }

  @Mutation(() => Boolean)
  async deleteEnvironment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.environmentsService.remove(id, user.id);
  }
}
