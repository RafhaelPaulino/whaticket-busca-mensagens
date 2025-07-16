import {
  Table,
  Column,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  Default,
  AutoIncrement,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import Queue from "./Queue";
import User from "./User";

@Table({
  tableName: "Distributions"
})
class Distribution extends Model<Distribution> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Queue)
  @Column({ unique: true })
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  nextUserId: number;

  @BelongsTo(() => User)
  nextUser: User;
  
  @Default(false)
  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Distribution;
