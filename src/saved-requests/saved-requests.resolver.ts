import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SavedRequestsService } from './saved-requests.service';
import { SavedRequest } from './entities/saved-request.entity';
import { CreateSavedRequestInput } from './dto/create-saved-request.input';
import { UpdateSavedRequestInput } from './dto/update-saved-request.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Reflector } from '@nestjs/core';

@Resolver(() => SavedRequest)
@UseGuards(new JwtAuthGuard(new Reflector()))
export class SavedRequestsResolver {
  constructor(private readonly savedRequestsService: SavedRequestsService) {}

  @Query(() => [SavedRequest])
  async savedRequests(@CurrentUser() user: User): Promise<SavedRequest[]> {
    return this.savedRequestsService.findAllByUser(user.id);
  }

  @Query(() => SavedRequest)
  async savedRequest(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<SavedRequest> {
    return this.savedRequestsService.findById(id, user.id);
  }

  @Query(() => [SavedRequest])
  async savedRequestsByCollection(
    @Args('collectionId', { type: () => ID }) collectionId: string,
    @CurrentUser() user: User,
  ): Promise<SavedRequest[]> {
    return this.savedRequestsService.findByCollection(collectionId, user.id);
  }

  @Mutation(() => SavedRequest)
  async createSavedRequest(
    @Args('input') input: CreateSavedRequestInput,
    @CurrentUser() user: User,
  ): Promise<SavedRequest> {
    return this.savedRequestsService.create(input, user.id);
  }

  @Mutation(() => SavedRequest)
  async updateSavedRequest(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSavedRequestInput,
    @CurrentUser() user: User,
  ): Promise<SavedRequest> {
    return this.savedRequestsService.update(id, input, user.id);
  }

  @Mutation(() => Boolean)
  async deleteSavedRequest(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.savedRequestsService.remove(id, user.id);
  }
}
