import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateEnvironmentInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  targetHost: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, string>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
