import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { User } from '../../users/entities/user.entity';

@ObjectType()
@Entity('request_history')
export class RequestHistory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Field(() => GraphQLJSON, { nullable: true })
  @Column('jsonb', { nullable: true })
  metadata: Record<string, string>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column('jsonb', { nullable: true })
  requestBody: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column('jsonb', { nullable: true })
  response: Record<string, any>;

  @Field({ nullable: true })
  @Column({ nullable: true })
  error: string;

  @Field(() => Int)
  @Column({ default: 0 })
  durationMs: number;

  @Field()
  @Column({ default: false })
  isStreaming: boolean;

  @Field()
  @Column({ default: 'SUCCESS' })
  status: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
