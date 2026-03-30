import { Resolver, Query, Args, ObjectType, Field, ID } from '@nestjs/graphql';
import { ProtoService, ProtoTree, ProtoServiceInfo } from './proto.service';
import { ProtoSchema } from './entities/proto-schema.entity';

@ObjectType()
class ProtoFieldGql {
  @Field()
  name: string;

  @Field()
  type: string;

  @Field({ nullable: true })
  typeName?: string;

  @Field()
  repeated: boolean;

  @Field()
  required: boolean;
}

@ObjectType()
class ProtoMethodGql {
  @Field()
  name: string;

  @Field()
  requestType: string;

  @Field()
  responseType: string;

  @Field()
  clientStreaming: boolean;

  @Field()
  serverStreaming: boolean;

  @Field(() => [ProtoFieldGql])
  inputFields: ProtoFieldGql[];

  @Field(() => [ProtoFieldGql])
  outputFields: ProtoFieldGql[];
}

@ObjectType()
class ProtoServiceGql {
  @Field()
  name: string;

  @Field(() => [ProtoMethodGql])
  methods: ProtoMethodGql[];
}

@ObjectType()
class ProtoTreeGql {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  filename: string;

  @Field({ nullable: true })
  packageName?: string;

  @Field(() => [ProtoServiceGql])
  services: ProtoServiceGql[];
}

@Resolver(() => ProtoSchema)
export class ProtoResolver {
  constructor(private readonly protoService: ProtoService) {}

  @Query(() => [ProtoSchema])
  async protoSchemas(): Promise<ProtoSchema[]> {
    return this.protoService.findAll();
  }

  @Query(() => ProtoSchema)
  async protoSchema(@Args('id') id: string): Promise<ProtoSchema> {
    return this.protoService.findById(id);
  }

  @Query(() => ProtoTreeGql)
  async protoTree(@Args('id') id: string): Promise<ProtoTree> {
    return this.protoService.getProtoTree(id);
  }
}
