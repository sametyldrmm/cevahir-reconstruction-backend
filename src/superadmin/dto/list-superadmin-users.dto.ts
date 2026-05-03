import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { USER_ROLES } from '../../users/domain/user-role.constants';

export class ListSuperadminUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsIn(Object.values(USER_ROLES))
  role?: string;
}
