import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { RequestCollection } from './entities/request-collection.entity';
import { CreateCollectionInput } from './dto/create-collection.input';
import { UpdateCollectionInput } from './dto/update-collection.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Reflector } from '@nestjs/core';

@Resolver(() => RequestCollection)
@UseGuards(new JwtAuthGuard(new Reflector()))
export class CollectionsResolver {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Query(() => [RequestCollection])
  async collections(@CurrentUser() user: User): Promise<RequestCollection[]> {
    return this.collectionsService.findAllByUser(user.id);
  }

  @Query(() => RequestCollection)
  async collection(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<RequestCollection> {
    return this.collectionsService.findById(id, user.id);
  }

  @Mutation(() => RequestCollection)
  async createCollection(
    @Args('input') input: CreateCollectionInput,
    @CurrentUser() user: User,
  ): Promise<RequestCollection> {
    return this.collectionsService.create(input, user.id);
  }

  @Mutation(() => RequestCollection)
  async updateCollection(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCollectionInput,
    @CurrentUser() user: User,
  ): Promise<RequestCollection> {
    return this.collectionsService.update(id, input, user.id);
  }

  @Mutation(() => Boolean)
  async deleteCollection(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.collectionsService.remove(id, user.id);
  }
}
