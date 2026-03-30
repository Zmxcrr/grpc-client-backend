import { InputType, PartialType } from '@nestjs/graphql';
import { CreateEnvironmentInput } from './create-environment.input';

@InputType()
export class UpdateEnvironmentInput extends PartialType(CreateEnvironmentInput) {}
