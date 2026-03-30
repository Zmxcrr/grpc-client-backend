import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
@Entity('grpc_call_logs')
export class GrpcCallLog {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  serviceName: string;

  @Field()
  @Column()
  methodName: string;

  @Field()
  @Column()
  targetHost: string;

  @Field()
  @Column({ default: 'SUCCESS' })
  status: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  error: string;

  @Field(() => Int)
  @Column({ default: 0 })
  latencyMs: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Field()
  @Column()
  protoId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
