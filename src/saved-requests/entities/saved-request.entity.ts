import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { User } from '../../users/entities/user.entity';
import { RequestCollection } from '../../collections/entities/request-collection.entity';

@ObjectType()
@Entity('saved_requests')
export class SavedRequest {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field()
  @Column()
  protoId: string;

  @Field()
  @Column()
  serviceName: string;

  @Field()
  @Column()
  methodName: string;

  @Field()
  @Column()
  targetHost: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  environmentId: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column('jsonb', { nullable: true, default: {} })
  metadata: Record<string, string>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column('jsonb', { nullable: true, default: {} })
  requestBody: Record<string, any>;

  @Field()
  @Column({ default: false })
  isStreaming: boolean;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => RequestCollection, { nullable: true })
  collection: RequestCollection;

  @Column({ nullable: true })
  collectionId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
