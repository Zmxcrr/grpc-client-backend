import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateSavedRequestInput {
  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => ID)
  @IsString()
  protoId: string;

  @Field()
  @IsString()
  serviceName: string;

  @Field()
  @IsString()
  methodName: string;

  @Field()
  @IsString()
  targetHost: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  environmentId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, string>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  requestBody?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isStreaming?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  collectionId?: string;
}
