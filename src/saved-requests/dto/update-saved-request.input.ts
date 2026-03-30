import { InputType, PartialType } from '@nestjs/graphql';
import { CreateSavedRequestInput } from './create-saved-request.input';

@InputType()
export class UpdateSavedRequestInput extends PartialType(CreateSavedRequestInput) {}
